import {useFocusEffect} from '@react-navigation/native';
import {Send, Trash2} from 'lucide-react-native';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {ProfileAvatar} from '../../components/profile/ProfileAvatar';
import {AppText} from '../../components/ui/AppText';
import {Button} from '../../components/ui/Button';
import {EmptyState} from '../../components/ui/EmptyState';
import {Screen} from '../../components/ui/Screen';
import {supabase} from '../../config/supabase';
import {useAuth} from '../../context/AuthContext';
import {
  deleteChatMessage,
  fetchChatMessages,
  sendChatMessage,
} from '../../services/chatService';
import {
  notifyChatMessageCreated,
  notifyInBackground,
} from '../../services/notificationService';
import {colors, radius, spacing} from '../../theme/theme';
import type {ChatMessage} from '../../types/domain';
import {formatDateTime} from '../../utils/date';
import {playerName} from '../../utils/player';

const CHAT_LIMIT = 60;

export function ChatScreen() {
  const {session, isAdmin} = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const shouldScrollToEndRef = useRef(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      shouldScrollToEndRef.current = true;
      const rows = await fetchChatMessages({limit: CHAT_LIMIT});
      setMessages(rows);
      setHasOlder(rows.length === CHAT_LIMIT);
    } catch (loadError) {
      Alert.alert(
        'Chat error',
        loadError instanceof Error ? loadError.message : 'Try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();

      const channel = supabase
        .channel('group-chat')
        .on(
          'postgres_changes',
          {event: '*', schema: 'public', table: 'chat_messages'},
          () => {
            load();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [load]),
  );

  useEffect(() => {
    if (!messages.length || !shouldScrollToEndRef.current) {
      return;
    }

    const timeout = setTimeout(() => {
      listRef.current?.scrollToEnd({animated: true});
      shouldScrollToEndRef.current = false;
    }, 100);

    return () => clearTimeout(timeout);
  }, [messages.length]);

  const loadOlder = async () => {
    const firstMessage = messages[0];
    if (!firstMessage || loadingOlder) {
      return;
    }

    try {
      setLoadingOlder(true);
      shouldScrollToEndRef.current = false;
      const olderRows = await fetchChatMessages({
        before: firstMessage.created_at,
        limit: CHAT_LIMIT,
      });
      setMessages(current => [...olderRows, ...current]);
      setHasOlder(olderRows.length === CHAT_LIMIT);
    } catch (loadError) {
      Alert.alert(
        'Chat error',
        loadError instanceof Error ? loadError.message : 'Could not load older messages.',
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async () => {
    if (!session?.user) {
      return;
    }

    const body = draft.trim();
    if (!body) {
      setError('Message is required');
      return;
    }

    if (body.length > 500) {
      setError('Keep messages under 500 characters');
      return;
    }

    try {
      setSending(true);
      const messageId = await sendChatMessage({userId: session.user.id, body});
      notifyInBackground(notifyChatMessageCreated(messageId));
      setDraft('');
      setError(undefined);
      await load();
    } catch (sendError) {
      Alert.alert(
        'Chat error',
        sendError instanceof Error ? sendError.message : 'Could not send message.',
      );
    } finally {
      setSending(false);
    }
  };

  const removeMessage = (message: ChatMessage) => {
    const mine = message.user_id === session?.user.id;
    if (!mine && !isAdmin) {
      return;
    }

    Alert.alert('Delete message?', 'This removes the message from the group chat.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChatMessage(message.id);
            setMessages(current => current.filter(row => row.id !== message.id));
          } catch (deleteError) {
            Alert.alert(
              'Delete error',
              deleteError instanceof Error ? deleteError.message : 'Try again.',
            );
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll={false}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <AppText variant="title">Chat</AppText>
          <AppText muted>Text-only group chat for the squad.</AppText>
        </View>

        <FlatList
          ref={listRef}
          contentContainerStyle={styles.list}
          data={messages}
          keyboardShouldPersistTaps="handled"
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <EmptyState
              title={loading ? 'Loading chat' : 'No messages yet'}
              body="Start the first bit of match-day chatter."
            />
          }
          ListHeaderComponent={
            hasOlder ? (
              <Button
                label={loadingOlder ? 'Loading...' : 'Load older'}
                loading={loadingOlder}
                onPress={loadOlder}
                style={styles.loadOlder}
                variant="secondary"
              />
            ) : null
          }
          renderItem={({item}) => (
            <ChatBubble
              currentUserId={session?.user.id ?? ''}
              isAdmin={isAdmin}
              message={item}
              onDelete={() => removeMessage(item)}
            />
          )}
        />

        <View style={styles.composer}>
          <View style={styles.inputWrap}>
            <TextInput
              maxLength={500}
              multiline
              onChangeText={value => {
                setDraft(value);
                setError(undefined);
              }}
              placeholder="Message the group"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={draft}
            />
            {error ? (
              <AppText variant="small" style={styles.error}>
                {error}
              </AppText>
            ) : null}
          </View>
          <Button
            label="Send"
            disabled={!draft.trim()}
            icon={<Send color={colors.white} size={16} />}
            loading={sending}
            onPress={send}
            style={styles.sendButton}
          />
        </View>
      </View>
    </Screen>
  );
}

function ChatBubble({
  currentUserId,
  isAdmin,
  message,
  onDelete,
}: {
  currentUserId: string;
  isAdmin: boolean;
  message: ChatMessage;
  onDelete: () => void;
}) {
  const mine = message.user_id === currentUserId;
  const canDelete = mine || isAdmin;

  return (
    <View style={[styles.messageRow, mine && styles.ownMessageRow]}>
      {!mine ? <ProfileAvatar profile={message.profile} size={34} /> : null}
      <View style={[styles.bubble, mine && styles.ownBubble]}>
        <View style={styles.messageHeader}>
          <View style={styles.messageMeta}>
            <AppText variant="small" style={styles.author}>
              {mine ? 'You' : playerName(message.profile)}
            </AppText>
            <AppText variant="small" muted>
              {formatDateTime(message.created_at)}
            </AppText>
          </View>
          {canDelete ? (
            <Pressable onPress={onDelete} hitSlop={10}>
              <Trash2 color={mine ? colors.onPrimary : colors.textMuted} size={15} />
            </Pressable>
          ) : null}
        </View>
        <AppText style={mine ? styles.ownText : undefined}>{message.body}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  header: {
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 1,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  loadOlder: {
    alignSelf: 'center',
    minHeight: 38,
  },
  messageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ownMessageRow: {
    justifyContent: 'flex-end',
  },
  bubble: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    maxWidth: '86%',
    padding: spacing.md,
  },
  ownBubble: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  messageHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  messageMeta: {
    flexShrink: 1,
  },
  author: {
    fontWeight: '800',
  },
  ownText: {
    color: colors.onPrimary,
  },
  composer: {
    alignItems: 'flex-end',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  inputWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
  },
  sendButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
});
