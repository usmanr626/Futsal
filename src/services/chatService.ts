import {supabase} from '../config/supabase';
import type {ChatMessage} from '../types/domain';

const DEFAULT_CHAT_LIMIT = 60;

export async function fetchChatMessages(options?: {
  before?: string;
  limit?: number;
}) {
  let query = supabase
    .from('chat_messages')
    .select('*, profile:profiles!chat_messages_user_id_fkey(*)')
    .order('created_at', {ascending: false})
    .limit(options?.limit ?? DEFAULT_CHAT_LIMIT);

  if (options?.before) {
    query = query.lt('created_at', options.before);
  }

  const {data, error} = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as ChatMessage[]).reverse();
}

export async function sendChatMessage(values: {userId: string; body: string}) {
  const body = values.body.trim();

  if (!body) {
    throw new Error('Message is required');
  }

  if (body.length > 500) {
    throw new Error('Keep messages under 500 characters');
  }

  const {data, error} = await supabase
    .from('chat_messages')
    .insert({
      user_id: values.userId,
      body,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function deleteChatMessage(messageId: string) {
  const {error} = await supabase
    .from('chat_messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    throw error;
  }
}
