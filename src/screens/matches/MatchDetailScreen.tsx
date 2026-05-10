import {RouteProp, useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  CirclePlus,
  Heart,
  ImagePlus,
  MessageCircle,
  Pencil,
  ThumbsDown,
  Trash2,
  Video,
} from 'lucide-react-native';
import React, {useCallback, useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '../../components/ui/AppText';
import {Button} from '../../components/ui/Button';
import {CachedImage} from '../../components/ui/CachedImage';
import {Card} from '../../components/ui/Card';
import {EmptyState} from '../../components/ui/EmptyState';
import {Screen} from '../../components/ui/Screen';
import {StatPill} from '../../components/ui/StatPill';
import {TextField} from '../../components/ui/TextField';
import {supabase} from '../../config/supabase';
import {useAuth} from '../../context/AuthContext';
import {getPhotoPreviewUrl, toggleReaction} from '../../services/mediaService';
import {
  addMatchComment,
  deleteMatchComment,
  deleteMatch,
  fetchMatchComments,
  fetchGoals,
  fetchMatch,
  fetchMatchParticipants,
  fetchMedia,
} from '../../services/matchService';
import {colors, spacing} from '../../theme/theme';
import type {
  Goal,
  Match,
  MatchComment,
  MatchMedia,
  MatchParticipant,
  ReactionType,
} from '../../types/domain';
import type {RootStackParamList} from '../../types/navigation';
import {formatDateTime} from '../../utils/date';
import {playerName} from '../../utils/player';
import {
  notifyInBackground,
  notifyMatchCommentCreated,
} from '../../services/notificationService';

type Route = RouteProp<RootStackParamList, 'MatchDetail'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

type ReactionCount = {
  like: number;
  dislike: number;
};

const COMMENT_PAGE_SIZE = 8;

export function MatchDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Navigation>();
  const {session, isAdmin} = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [media, setMedia] = useState<MatchMedia[]>([]);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Record<string, string>>({});
  const [reactionCounts, setReactionCounts] = useState<Record<string, ReactionCount>>({});
  const [userReactions, setUserReactions] = useState<Record<string, ReactionType>>({});
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | undefined>();
  const [commentsLoading, setCommentsLoading] = useState(false);

  const loadComments = useCallback(
    async (offset = 0, replace = true) => {
      try {
        setCommentsLoading(true);
        const result = await fetchMatchComments(route.params.matchId, {
          limit: COMMENT_PAGE_SIZE,
          offset,
        });
        setCommentTotal(result.total);
        setComments(current =>
          replace ? result.comments : [...current, ...result.comments],
        );
      } catch (error) {
        Alert.alert(
          'Comments error',
          error instanceof Error ? error.message : 'Try again.',
        );
      } finally {
        setCommentsLoading(false);
      }
    },
    [route.params.matchId],
  );

  const load = useCallback(async () => {
    try {
      const [matchRow, goalRows, mediaRows, participantRows] = await Promise.all([
        fetchMatch(route.params.matchId),
        fetchGoals(route.params.matchId),
        fetchMedia(route.params.matchId),
        fetchMatchParticipants(route.params.matchId),
      ]);
      setMatch(matchRow);
      setGoals(goalRows);
      setMedia(mediaRows);
      setParticipants(participantRows);

      if (mediaRows.length) {
        const previews: Record<string, string> = {};
        await Promise.all(
          mediaRows.map(async item => {
            const url = await getPhotoPreviewUrl(item);
            if (url) {
              previews[item.id] = url;
            }
          }),
        );
        setPhotoPreviewUrls(previews);

        const {data, error} = await supabase
          .from('media_reactions')
          .select('media_id, reaction, user_id')
          .in(
            'media_id',
            mediaRows.map(item => item.id),
          );
        if (error) {
          throw error;
        }

        const counts: Record<string, ReactionCount> = {};
        const currentUserReactions: Record<string, ReactionType> = {};
        for (const item of mediaRows) {
          counts[item.id] = {like: 0, dislike: 0};
        }
        for (const row of data ?? []) {
          const mediaId = row.media_id as string;
          const reaction = row.reaction as ReactionType;
          counts[mediaId][reaction] += 1;
          if (row.user_id === session?.user.id) {
            currentUserReactions[mediaId] = reaction;
          }
        }
        setReactionCounts(counts);
        setUserReactions(currentUserReactions);
      } else {
        setPhotoPreviewUrls({});
        setReactionCounts({});
        setUserReactions({});
      }
    } catch (error) {
      Alert.alert('Load error', error instanceof Error ? error.message : 'Try again.');
    }
  }, [route.params.matchId, session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
      loadComments(0, true);
    }, [load, loadComments]),
  );

  const submitComment = async () => {
    if (!session?.user) {
      return;
    }

    const body = commentText.trim();
    if (!body) {
      setCommentError('Comment is required');
      return;
    }

    if (body.length > 500) {
      setCommentError('Keep comments under 500 characters');
      return;
    }

    try {
      setCommentsLoading(true);
      const commentId = await addMatchComment({
        matchId: route.params.matchId,
        userId: session.user.id,
        body,
      });
      notifyInBackground(notifyMatchCommentCreated(commentId));
      setCommentText('');
      setCommentError(undefined);
      await loadComments(0, true);
    } catch (error) {
      Alert.alert(
        'Comment error',
        error instanceof Error ? error.message : 'Could not add comment.',
      );
    } finally {
      setCommentsLoading(false);
    }
  };

  const removeComment = (comment: MatchComment) => {
    Alert.alert('Delete comment?', 'This removes the comment from the match.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMatchComment(comment.id);
            await loadComments(0, true);
          } catch (error) {
            Alert.alert(
              'Delete error',
              error instanceof Error ? error.message : 'Try again.',
            );
          }
        },
      },
    ]);
  };

  const reactToMedia = async (mediaId: string, reaction: 'like' | 'dislike') => {
    if (!session?.user) {
      return;
    }

    try {
      await toggleReaction(mediaId, session.user.id, reaction);
      await load();
    } catch (error) {
      Alert.alert('Reaction error', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const removeMatch = () => {
    Alert.alert('Delete match?', 'This removes the match, its goals, media, and teams.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMatch(route.params.matchId);
            navigation.goBack();
          } catch (error) {
            Alert.alert(
              'Delete error',
              error instanceof Error ? error.message : 'Try again.',
            );
          }
        },
      },
    ]);
  };

  if (!match) {
    return (
      <Screen>
        <EmptyState title="Loading match" />
      </Screen>
    );
  }

  const hasScore = match.team_a_score !== null && match.team_b_score !== null;
  const isCompleted = match.status === 'completed';
  const matchHasPassed = new Date(match.match_date).getTime() <= Date.now();
  const canComment = isCompleted || matchHasPassed;
  const canLoadMoreComments = comments.length < commentTotal;
  const teamAPlayers = participants.filter(
    participant => participant.team === 'team_a',
  );
  const teamBPlayers = participants.filter(
    participant => participant.team === 'team_b',
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="label" muted>
            {formatDateTime(match.match_date)}
          </AppText>
          <AppText variant="title">{match.title}</AppText>
          {match.venue ? <AppText muted>{match.venue}</AppText> : null}
        </View>
        {isAdmin ? (
          <View style={styles.headerActions}>
            <Button
              label="Edit"
              icon={<Pencil color={colors.text} size={16} />}
              variant="secondary"
              onPress={() => navigation.navigate('AdminMatchForm', {matchId: match.id})}
            />
            <Button
              label="Delete"
              icon={<Trash2 color={colors.white} size={16} />}
              variant="danger"
              onPress={removeMatch}
            />
          </View>
        ) : null}
      </View>

      <Card style={styles.scoreCard}>
        {isCompleted ? (
          <View style={styles.scoreRow}>
            <StatPill
              label={match.team_a_name}
              value={match.team_a_score ?? '-'}
              tone="red"
            />
            <StatPill
              label={match.team_b_name}
              value={match.team_b_score ?? '-'}
              tone="blue"
            />
          </View>
        ) : (
          <View style={styles.versusRow}>
            <AppText variant="heading">{match.team_a_name}</AppText>
            <AppText muted>vs</AppText>
            <AppText variant="heading">{match.team_b_name}</AppText>
          </View>
        )}
        {isCompleted && match.motm ? (
          <View style={styles.motm}>
            <AppText variant="label" muted>
              Man of the Match
            </AppText>
            <AppText variant="heading">{playerName(match.motm)}</AppText>
          </View>
        ) : null}
        {match.notes ? <AppText>{match.notes}</AppText> : null}
      </Card>

      <Card style={styles.teamCard}>
        <View style={styles.teamColumn}>
          <AppText variant="label" muted>
            {match.team_a_name}
          </AppText>
          <AppText>
            {teamAPlayers.length
              ? teamAPlayers
                  .map(participant => playerName(participant.profile))
                  .join(', ')
              : 'No players selected'}
          </AppText>
        </View>
        <View style={styles.teamColumn}>
          <AppText variant="label" muted>
            {match.team_b_name}
          </AppText>
          <AppText>
            {teamBPlayers.length
              ? teamBPlayers
                  .map(participant => playerName(participant.profile))
                  .join(', ')
              : 'No players selected'}
          </AppText>
        </View>
      </Card>

      {!isCompleted && isAdmin && matchHasPassed ? (
        <Card style={styles.completeCard}>
          <AppText variant="heading">Ready to complete</AppText>
          <AppText muted>Add the final score, goals, and media after the match.</AppText>
          <Button
            label="Complete match"
            onPress={() => navigation.navigate('AdminMatchForm', {matchId: match.id})}
          />
        </Card>
      ) : null}

      {isCompleted && isAdmin ? (
        <Card style={styles.manageCard}>
          <AppText variant="heading">Manage result</AppText>
          <View style={styles.manageActions}>
            <Button
              label="Add goal"
              icon={<CirclePlus color={colors.text} size={16} />}
              onPress={() => navigation.navigate('AdminMatchForm', {matchId: match.id})}
              style={styles.manageButton}
              variant="secondary"
            />
            <Button
              label="Upload media"
              icon={<ImagePlus color={colors.text} size={16} />}
              onPress={() => navigation.navigate('AdminMatchForm', {matchId: match.id})}
              style={styles.manageButton}
              variant="secondary"
            />
          </View>
        </Card>
      ) : null}

      {isCompleted ? (
        <View style={styles.section}>
          <AppText variant="heading">Goals</AppText>
          {hasScore && goals.length ? (
            goals.map(goal => (
              <Card key={goal.id} style={styles.goalRow}>
                <AppText>
                  {goal.minute !== null ? `${goal.minute}' ` : ''}
                  {playerName(goal.scorer)}
                </AppText>
                <AppText variant="small" muted>
                  {goal.team === 'team_a' ? match.team_a_name : match.team_b_name}
                </AppText>
              </Card>
            ))
          ) : (
            <EmptyState title="No scorers yet" />
          )}
        </View>
      ) : null}

      {isCompleted ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="heading">Media</AppText>
            {media.length ? (
              <Button
                label="Open gallery"
                onPress={() =>
                  navigation.navigate('MatchGallery', {matchId: match.id})
                }
                style={styles.galleryButton}
                variant="secondary"
              />
            ) : null}
          </View>
          {media.length ? (
            <View style={styles.mediaGrid}>
              {media.map(item => {
                const counts = reactionCounts[item.id] ?? {like: 0, dislike: 0};
                const userReaction = userReactions[item.id];
                const previewUrl = photoPreviewUrls[item.id];

                return (
                  <View key={item.id} style={styles.mediaItem}>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('MatchGallery', {matchId: match.id})
                      }
                      style={styles.mediaPreview}>
                      {item.media_type === 'photo' && previewUrl ? (
                        <CachedImage uri={previewUrl} style={styles.mediaImage} />
                      ) : item.media_type === 'video' ? (
                        <Video color={colors.white} size={28} />
                      ) : (
                        <AppText variant="label" style={styles.mediaPreviewText}>
                          Photo
                        </AppText>
                      )}
                    </Pressable>
                    <View style={styles.mediaActions}>
                      <Button
                        label={`${counts.like}`}
                        icon={
                          <Heart
                            color={
                              userReaction === 'like'
                                ? colors.primaryAlt
                                : colors.text
                            }
                            fill={
                              userReaction === 'like'
                                ? colors.primaryAlt
                                : 'transparent'
                            }
                            size={16}
                          />
                        }
                        variant="secondary"
                        onPress={() => reactToMedia(item.id, 'like')}
                        style={styles.reactionButton}
                      />
                      <Button
                        label={`${counts.dislike}`}
                        icon={
                          <ThumbsDown
                            color={
                              userReaction === 'dislike'
                                ? colors.primaryAlt
                                : colors.text
                            }
                            fill={
                              userReaction === 'dislike'
                                ? colors.primaryAlt
                                : 'transparent'
                            }
                            size={16}
                          />
                        }
                        variant="secondary"
                        onPress={() => reactToMedia(item.id, 'dislike')}
                        style={styles.reactionButton}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState title="No media yet" body="Admins can add photos and one video." />
          )}
        </View>
      ) : null}

      {canComment ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.commentTitle}>
              <MessageCircle color={colors.primaryAlt} size={20} />
              <AppText variant="heading">Comments</AppText>
            </View>
            <AppText variant="small" muted>
              {commentTotal}
            </AppText>
          </View>

          <Card style={styles.commentComposer}>
            <TextField
              error={commentError}
              label="Add comment"
              maxLength={500}
              multiline
              onChangeText={value => {
                setCommentText(value);
                setCommentError(undefined);
              }}
              placeholder="Say something about the match"
              style={styles.commentInput}
              value={commentText}
            />
            <Button
              label="Post comment"
              loading={commentsLoading}
              onPress={submitComment}
            />
          </Card>

          {comments.length ? (
            comments.map(comment => (
              <Card key={comment.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentMeta}>
                    <AppText>{playerName(comment.profile)}</AppText>
                    <AppText variant="small" muted>
                      {formatDateTime(comment.created_at)}
                    </AppText>
                  </View>
                  {isAdmin || comment.user_id === session?.user.id ? (
                    <Button
                      label="Delete"
                      icon={<Trash2 color={colors.text} size={14} />}
                      onPress={() => removeComment(comment)}
                      style={styles.commentDeleteButton}
                      variant="secondary"
                    />
                  ) : null}
                </View>
                <AppText>{comment.body}</AppText>
              </Card>
            ))
          ) : (
            <EmptyState
              title={commentsLoading ? 'Loading comments...' : 'No comments yet'}
              body="Be the first to say something about this match."
            />
          )}

          {canLoadMoreComments ? (
            <Button
              label={commentsLoading ? 'Loading...' : 'See more comments'}
              disabled={commentsLoading}
              onPress={() => loadComments(comments.length, false)}
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  headerActions: {
    gap: spacing.sm,
  },
  scoreCard: {
    gap: spacing.lg,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  versusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  motm: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: spacing.md,
  },
  teamCard: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  teamColumn: {
    gap: spacing.xs,
  },
  completeCard: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  manageCard: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  manageActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  manageButton: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  section: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  galleryButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  goalRow: {
    gap: spacing.xs,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mediaItem: {
    gap: spacing.sm,
    width: '48.5%',
  },
  mediaPreview: {
    alignItems: 'center',
    backgroundColor: colors.black,
    borderRadius: 8,
    height: 132,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mediaImage: {
    height: '100%',
    width: '100%',
  },
  mediaPreviewText: {
    color: colors.white,
  },
  mediaActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reactionButton: {
    flex: 1,
  },
  commentTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  commentComposer: {
    gap: spacing.md,
  },
  commentInput: {
    minHeight: 88,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  commentCard: {
    gap: spacing.sm,
  },
  commentHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  commentMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  commentDeleteButton: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
});
