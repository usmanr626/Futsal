import {supabase} from '../config/supabase';
import type {Match} from '../types/domain';

type ReminderType = '24h' | '2h';

const DAY_MS = 24 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

async function invokeNotification(body: Record<string, unknown>) {
  const {data: authData, error: sessionError} = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const token = authData.session?.access_token;
  if (!token) {
    throw new Error('Sign in required');
  }

  const {error} = await supabase.functions.invoke('send-notification', {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    const context = error.context as Response | undefined;
    if (context) {
      const message = await readFunctionError(context);
      if (message) {
        throw new Error(message);
      }
    }

    throw error;
  }
}

async function readFunctionError(response: Response) {
  try {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      const body = JSON.parse(text) as {error?: string; message?: string};
      return body.error ?? body.message ?? text;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

export function sendTestPushNotification() {
  return invokeNotification({type: 'test'});
}

export function sendAdminBroadcastNotification(message: string) {
  return invokeNotification({type: 'admin_broadcast', message});
}

export function notifyMatchRequestCreated(requestId: string) {
  return invokeNotification({type: 'match_request_created', requestId});
}

export function notifyMatchRequestVote(requestId: string) {
  return invokeNotification({type: 'match_request_vote', requestId});
}

export function notifyMatchScheduled(matchId: string) {
  return invokeNotification({type: 'match_scheduled', matchId});
}

export function notifyMatchCommentCreated(commentId: string) {
  return invokeNotification({type: 'match_comment_created', commentId});
}

export function notifyMatchReminder(matchId: string, reminderType: ReminderType) {
  return invokeNotification({type: 'match_reminder', matchId, reminderType});
}

export function sendDueMatchReminders(matches: Match[]) {
  const now = Date.now();
  const reminderTasks = matches.flatMap(match =>
    dueReminderTypes(match, now).map(reminderType =>
      notifyMatchReminder(match.id, reminderType),
    ),
  );

  return Promise.all(reminderTasks);
}

export function notifyInBackground(task: Promise<unknown>) {
  task.catch(() => {
    // Push delivery should never block the main match flow.
  });
}

function dueReminderTypes(match: Match, now: number): ReminderType[] {
  const status = match.status as string;
  if (status !== 'upcoming' && status !== 'scheduled') {
    return [];
  }

  const msUntilMatch = new Date(match.match_date).getTime() - now;
  if (msUntilMatch <= 0) {
    return [];
  }

  if (msUntilMatch <= TWO_HOURS_MS) {
    return ['2h'];
  }

  if (msUntilMatch <= DAY_MS) {
    return ['24h'];
  }

  return [];
}
