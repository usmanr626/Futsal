import {supabase} from '../config/supabase';

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

export function notifyInBackground(task: Promise<unknown>) {
  task.catch(() => {
    // Push delivery should never block the main match flow.
  });
}
