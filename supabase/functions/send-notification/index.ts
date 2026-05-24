import {createClient} from 'jsr:@supabase/supabase-js@2';

type NotificationPayload =
  | {type: 'test'; title?: string; body?: string}
  | {type: 'admin_broadcast'; message: string}
  | {type: 'match_request_created'; requestId: string}
  | {type: 'match_request_vote'; requestId: string}
  | {type: 'match_scheduled'; matchId: string}
  | {type: 'match_reminder'; matchId: string; reminderType: '24h' | '2h'}
  | {type: 'match_comment_created'; commentId: string}
  | {type: 'chat_message_created'; messageId: string};

type ProfileRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

type GoogleToken = {
  access_token: string;
  expires_in: number;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const dayMs = 24 * 60 * 60 * 1000;
const twoHoursMs = 2 * 60 * 60 * 1000;

let cachedGoogleToken: {token: string; expiresAt: number} | null = null;
let supabaseAdminClient: ReturnType<typeof createClient> | null = null;

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders});
  }

  if (req.method !== 'POST') {
    return json({error: 'Method not allowed'}, 405);
  }

  try {
    const actorId = getActorId(req);
    if (!actorId) {
      throw new HttpError(401, 'Sign in required');
    }

    const payload = (await req.json()) as NotificationPayload;
    const result = await handleNotification(actorId, payload);

    return json(result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : 'Could not send notification';

    console.error('send-notification error', {status, message});
    return json({error: message}, status);
  }
});

async function handleNotification(actorId: string, payload: NotificationPayload) {
  switch (payload.type) {
    case 'test':
      return notifyUsers({
        recipientUserIds: [actorId],
        type: 'test',
        title: payload.title ?? 'FutsalApp push is working',
        body: payload.body ?? 'Your Android device is ready for match updates.',
        data: {event: 'test'},
      });

    case 'admin_broadcast':
      return handleAdminBroadcast(actorId, payload.message);

    case 'match_request_created':
      return handleMatchRequestCreated(actorId, payload.requestId);

    case 'match_request_vote':
      return handleMatchRequestVote(actorId, payload.requestId);

    case 'match_scheduled':
      return handleMatchScheduled(actorId, payload.matchId);

    case 'match_reminder':
      return handleMatchReminder(actorId, payload.matchId, payload.reminderType);

    case 'match_comment_created':
      return handleMatchCommentCreated(actorId, payload.commentId);

    case 'chat_message_created':
      return handleChatMessageCreated(actorId, payload.messageId);

    default:
      throw new HttpError(400, 'Unknown notification type');
  }
}

async function handleAdminBroadcast(actorId: string, message: string) {
  if (!(await isAdmin(actorId))) {
    throw new HttpError(403, 'Only admins can send broadcast notifications');
  }

  const body = message.trim();
  if (!body) {
    throw new HttpError(400, 'Message is required');
  }

  if (body.length > 140) {
    throw new HttpError(400, 'Message must be 140 characters or less');
  }

  const admin = await getProfile(actorId);

  return notifyUsers({
    recipientUserIds: await getActiveUserIds(),
    type: 'admin_broadcast',
    title: 'Futsal update',
    body,
    data: {
      event: 'admin_broadcast',
      fromUserId: actorId,
      fromName: displayName(admin),
    },
  });
}

async function handleMatchCommentCreated(actorId: string, commentId: string) {
  assertUuid(commentId, 'commentId');

  const comment = await getMatchComment(commentId);
  if (comment.user_id !== actorId && !(await isAdmin(actorId))) {
    throw new HttpError(403, 'You cannot notify for this comment');
  }

  const commenter = await getProfile(comment.user_id);
  const recipientUserIds = (await getActiveUserIds()).filter(id => id !== actorId);

  return notifyUsers({
    recipientUserIds,
    type: 'match_comment_created',
    title: 'New match comment',
    body: `${displayName(commenter)} commented on ${comment.match.title}.`,
    data: {
      event: 'match_comment_created',
      commentId,
      matchId: comment.match_id,
    },
  });
}

async function handleChatMessageCreated(actorId: string, messageId: string) {
  assertUuid(messageId, 'messageId');

  const message = await getChatMessage(messageId);
  if (message.user_id !== actorId && !(await isAdmin(actorId))) {
    throw new HttpError(403, 'You cannot notify for this chat message');
  }

  const sender = await getProfile(message.user_id);
  const recipientUserIds = (await getActiveUserIds()).filter(id => id !== actorId);

  return notifyUsers({
    recipientUserIds,
    type: 'chat_message_created',
    title: 'New group chat message',
    body: `${displayName(sender)}: ${truncate(message.body, 90)}`,
    data: {
      event: 'chat_message_created',
      messageId,
    },
  });
}

async function handleMatchRequestCreated(actorId: string, requestId: string) {
  assertUuid(requestId, 'requestId');

  const request = await getMatchRequest(requestId);
  if (request.requested_by !== actorId && !(await isAdmin(actorId))) {
    throw new HttpError(403, 'You cannot notify for this request');
  }

  const requester = await getProfile(request.requested_by);
  const recipientUserIds = (await getActiveUserIds()).filter(id => id !== actorId);

  return notifyUsers({
    recipientUserIds,
    type: 'match_request_created',
    title: 'New match request',
    body: `${displayName(requester)} wants to play on ${formatDate(
      request.requested_date,
    )}.`,
    data: {event: 'match_request_created', requestId},
  });
}

async function handleMatchRequestVote(actorId: string, requestId: string) {
  assertUuid(requestId, 'requestId');

  const request = await getMatchRequest(requestId);
  const vote = await getRequestVote(requestId, actorId);
  if (!vote) {
    throw new HttpError(403, 'Vote not found for this user');
  }

  if (request.requested_by === actorId) {
    return {recipients: 0, devices: 0, sent: 0, skipped: 'own_request'};
  }

  const voter = await getProfile(actorId);

  return notifyUsers({
    recipientUserIds: [request.requested_by],
    type: 'match_request_vote',
    title: 'Vote received',
    body: `${displayName(voter)} voted ${vote.vote} on your match request.`,
    data: {event: 'match_request_vote', requestId, vote: vote.vote},
  });
}

async function handleMatchScheduled(actorId: string, matchId: string) {
  assertUuid(matchId, 'matchId');

  const match = await getMatch(matchId);
  if (match.status !== 'upcoming') {
    throw new HttpError(400, 'Only upcoming matches can send scheduled notifications');
  }

  const admin = await isAdmin(actorId);
  const requestParticipant = match.request_id
    ? await getRequestVote(match.request_id, actorId)
    : null;

  if (!admin && !requestParticipant) {
    throw new HttpError(403, 'You cannot notify for this match');
  }

  return notifyUsers({
    recipientUserIds: await getActiveUserIds(),
    type: 'match_scheduled',
    title: 'Match scheduled',
    body: `${match.title} is set for ${formatDate(match.match_date)}.`,
    data: {event: 'match_scheduled', matchId},
  });
}

async function handleMatchReminder(
  actorId: string,
  matchId: string,
  reminderType: '24h' | '2h',
) {
  assertUuid(matchId, 'matchId');

  if (reminderType !== '24h' && reminderType !== '2h') {
    throw new HttpError(400, 'Reminder type is invalid');
  }

  const match = await getMatch(matchId);
  const status = match.status as string;
  if (status !== 'upcoming' && status !== 'scheduled') {
    return {recipients: 0, devices: 0, sent: 0, skipped: 'not_upcoming'};
  }

  const msUntilMatch = new Date(match.match_date).getTime() - Date.now();
  const due =
    reminderType === '2h'
      ? msUntilMatch > 0 && msUntilMatch <= twoHoursMs
      : msUntilMatch > twoHoursMs && msUntilMatch <= dayMs;

  if (!due) {
    return {recipients: 0, devices: 0, sent: 0, skipped: 'not_due'};
  }

  const recorded = await recordMatchReminder(matchId, reminderType, actorId);
  if (!recorded) {
    return {recipients: 0, devices: 0, sent: 0, skipped: 'already_sent'};
  }

  return notifyUsers({
    recipientUserIds: await getActiveUserIds(),
    type: 'match_reminder',
    title: reminderType === '24h' ? 'Match reminder' : 'Match starts soon',
    body: `${match.title} is set for ${formatDate(match.match_date)}.`,
    data: {event: 'match_reminder', matchId, reminderType},
  });
}

async function notifyUsers(input: {
  recipientUserIds: string[];
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
}) {
  const recipientUserIds = [...new Set(input.recipientUserIds)].filter(Boolean);

  if (!recipientUserIds.length) {
    return {recipients: 0, devices: 0, sent: 0};
  }

  const notificationRows = recipientUserIds.map(userId => ({
    user_id: userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data,
  }));
  const supabaseAdmin = getSupabaseAdmin();

  const {error: notificationError} = await supabaseAdmin
    .from('notifications')
    .insert(notificationRows);

  if (notificationError) {
    throw new HttpError(500, notificationError.message);
  }

  const {data: devices, error: deviceError} = await supabaseAdmin
    .from('notification_devices')
    .select('push_token')
    .eq('enabled', true)
    .in('user_id', recipientUserIds);

  if (deviceError) {
    throw new HttpError(500, deviceError.message);
  }

  const deviceRows = devices ?? [];
  const results = await Promise.all(
    deviceRows.map(device =>
      sendFcmMessage(device.push_token, input.title, input.body, input.data),
    ),
  );

  const invalidTokens = results
    .filter(result => !result.ok && result.disableToken)
    .map(result => result.token);

  if (invalidTokens.length) {
    await supabaseAdmin
      .from('notification_devices')
      .update({enabled: false})
      .in('push_token', invalidTokens);
  }

  return {
    recipients: recipientUserIds.length,
    devices: deviceRows.length,
    sent: results.filter(result => result.ok).length,
    failed: results.filter(result => !result.ok).length,
  };
}

async function sendFcmMessage(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  const serviceAccount = getServiceAccount();
  const accessToken = await getGoogleAccessToken(serviceAccount);

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {title, body},
          data: stringifyData(data),
          android: {priority: 'high'},
        },
      }),
    },
  );

  const responseText = await response.text();
  const disableToken =
    !response.ok &&
    (responseText.includes('UNREGISTERED') ||
      responseText.includes('INVALID_ARGUMENT'));

  if (!response.ok) {
    console.error('FCM send failed', {
      status: response.status,
      responseText,
    });
  }

  return {ok: response.ok, token, disableToken};
}

async function getGoogleAccessToken(serviceAccount: ServiceAccount) {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now()) {
    return cachedGoogleToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
  const claims = base64UrlEncode(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsignedJwt = `${header}.${claims}`;
  const signature = await signJwt(unsignedJwt, serviceAccount.private_key);
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new HttpError(500, `Google OAuth failed with ${response.status}`);
  }

  const token = (await response.json()) as GoogleToken;
  cachedGoogleToken = {
    token: token.access_token,
    expiresAt: Date.now() + Math.max(token.expires_in - 60, 60) * 1000,
  };

  return cachedGoogleToken.token;
}

async function signJwt(unsignedJwt: string, privateKey: string) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedJwt),
  );

  return base64UrlEncode(new Uint8Array(signature));
}

function getServiceAccount() {
  const encoded = Deno.env.get('FCM_SERVICE_ACCOUNT_B64');
  if (!encoded) {
    throw new HttpError(500, 'FCM service account secret is missing');
  }

  return JSON.parse(atob(encoded)) as ServiceAccount;
}

async function getMatchRequest(requestId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const {data, error} = await supabaseAdmin
    .from('match_requests')
    .select('id, requested_by, requested_date, venue, status, scheduled_match_id')
    .eq('id', requestId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data) {
    throw new HttpError(404, 'Match request not found');
  }

  return data;
}

async function getRequestVote(requestId: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const {data, error} = await supabaseAdmin
    .from('match_request_votes')
    .select('vote')
    .eq('request_id', requestId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  return data;
}

async function getMatch(matchId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const {data, error} = await supabaseAdmin
    .from('matches')
    .select('id, request_id, title, match_date, status')
    .eq('id', matchId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data) {
    throw new HttpError(404, 'Match not found');
  }

  return data;
}

async function recordMatchReminder(
  matchId: string,
  reminderType: '24h' | '2h',
  triggeredBy: string,
) {
  const supabaseAdmin = getSupabaseAdmin();
  const {error} = await supabaseAdmin.from('match_reminders').insert({
    match_id: matchId,
    reminder_type: reminderType,
    triggered_by: triggeredBy,
  });

  if (!error) {
    return true;
  }

  if (error.code === '23505') {
    return false;
  }

  throw new HttpError(500, error.message);
}

async function getMatchComment(commentId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const {data, error} = await supabaseAdmin
    .from('match_comments')
    .select('id, match_id, user_id, match:matches!match_comments_match_id_fkey(id, title)')
    .eq('id', commentId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data) {
    throw new HttpError(404, 'Match comment not found');
  }

  const match = Array.isArray(data.match) ? data.match[0] : data.match;
  if (!match) {
    throw new HttpError(404, 'Comment match not found');
  }

  return {
    id: data.id as string,
    match_id: data.match_id as string,
    user_id: data.user_id as string,
    match: match as {id: string; title: string},
  };
}

async function getChatMessage(messageId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const {data, error} = await supabaseAdmin
    .from('chat_messages')
    .select('id, user_id, body')
    .eq('id', messageId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data) {
    throw new HttpError(404, 'Chat message not found');
  }

  return {
    id: data.id as string,
    user_id: data.user_id as string,
    body: data.body as string,
  };
}

async function getProfile(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const {data, error} = await supabaseAdmin
    .from('profiles')
    .select('id, username, first_name, last_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  return data as ProfileRow | null;
}

async function getActiveUserIds() {
  const supabaseAdmin = getSupabaseAdmin();
  const {data, error} = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('is_active', true);

  if (error) {
    throw new HttpError(500, error.message);
  }

  return (data ?? []).map(row => row.id as string);
}

async function isAdmin(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const {data, error} = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  return Boolean(data);
}

function getSupabaseAdmin() {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey =
    Deno.env.get('PROJECT_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError(500, 'Supabase service credentials are missing');
  }

  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);

  return supabaseAdminClient;
}

function getActorId(req: Request) {
  const authorization = req.headers.get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  const payload = decodeJwtPayload(token);

  return typeof payload?.sub === 'string' ? payload.sub : null;
}

function decodeJwtPayload(token: string) {
  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    return JSON.parse(atob(padded)) as {sub?: string};
  } catch {
    return null;
  }
}

function displayName(profile: ProfileRow | null) {
  if (!profile) {
    return 'A player';
  }

  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
    profile.username ||
    'A player'
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Karachi',
  }).format(new Date(value));
}

function truncate(value: string, maxLength: number) {
  const cleanValue = value.replace(/\s+/g, ' ').trim();

  return cleanValue.length > maxLength
    ? `${cleanValue.slice(0, maxLength - 3)}...`
    : cleanValue;
}

function stringifyData(data: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value)]),
  );
}

function assertUuid(value: string, name: string) {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value)) {
    throw new HttpError(400, `${name} is invalid`);
  }
}

function base64UrlEncode(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]+$/, '');
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
