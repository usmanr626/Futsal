import {Check, Clock3, Pencil, Trash2, X} from 'lucide-react-native';
import React, {useMemo, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {colors, spacing} from '../../theme/theme';
import type {
  MatchRequest,
  MatchRequestParticipant,
  MatchRequestVote,
  VoteChoice,
} from '../../types/domain';
import {formatDateTime} from '../../utils/date';
import {playerName} from '../../utils/player';
import {AppText} from '../ui/AppText';
import {Button} from '../ui/Button';
import {Card} from '../ui/Card';

type RequestCardProps = {
  request: MatchRequest;
  participants: MatchRequestParticipant[];
  votes: MatchRequestVote[];
  currentUserId: string;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onVote: (vote: VoteChoice) => void;
};

export function RequestCard({
  request,
  participants,
  votes,
  currentUserId,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  onVote,
}: RequestCardProps) {
  const [visibleVote, setVisibleVote] = useState<VoteChoice | null>(null);
  const counts = useMemo(
    () => ({
      yes: votes.filter(vote => vote.vote === 'yes').length,
      maybe: votes.filter(vote => vote.vote === 'maybe').length,
      no: votes.filter(vote => vote.vote === 'no').length,
    }),
    [votes],
  );
  const myVote = votes.find(vote => vote.user_id === currentUserId)?.vote;
  const open = request.status === 'open';
  const teamAPlayers = participants.filter(
    participant => participant.team === 'team_a',
  );
  const teamBPlayers = participants.filter(
    participant => participant.team === 'team_b',
  );
  const selectedVotes = useMemo(
    () => votes.filter(vote => vote.vote === visibleVote),
    [visibleVote, votes],
  );
  const selectedVoteLabel =
    visibleVote === 'yes' ? 'Yes' : visibleVote === 'no' ? 'No' : 'Maybe';

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View>
          <AppText variant="label" muted>
            Match Request
          </AppText>
          <AppText variant="heading">{formatDateTime(request.requested_date)}</AppText>
        </View>
        <View style={styles.status}>
          <AppText variant="label">{request.status}</AppText>
        </View>
      </View>

      <AppText muted>
        Requested by {playerName(request.requester)}
        {request.venue ? ` at ${request.venue}` : ''}
      </AppText>
      {request.note ? <AppText>{request.note}</AppText> : null}

      {participants.length ? (
        <View style={styles.teams}>
          <TeamLine label="Team A" participants={teamAPlayers} />
          <TeamLine label="Team B" participants={teamBPlayers} />
        </View>
      ) : null}

      <View style={styles.voteCounts}>
        <VoteCount
          tone="green"
          label="Yes"
          value={counts.yes}
          onPress={() => setVisibleVote('yes')}
        />
        <VoteCount
          tone="amber"
          label="Maybe"
          value={counts.maybe}
          onPress={() => setVisibleVote('maybe')}
        />
        <VoteCount
          tone="red"
          label="No"
          value={counts.no}
          onPress={() => setVisibleVote('no')}
        />
      </View>

      {open ? (
        <View style={styles.actions}>
          <Button
            label={myVote === 'yes' ? 'Yes picked' : 'Yes'}
            icon={<Check color={colors.white} size={16} />}
            onPress={() => onVote('yes')}
            style={styles.action}
          />
          <Button
            label={myVote === 'maybe' ? 'Maybe picked' : 'Maybe'}
            icon={<Clock3 color={colors.text} size={16} />}
            variant="secondary"
            onPress={() => onVote('maybe')}
            style={styles.action}
          />
          <Button
            label={myVote === 'no' ? 'No picked' : 'No'}
            icon={<X color={colors.white} size={16} />}
            variant="danger"
            onPress={() => onVote('no')}
            style={styles.action}
          />
        </View>
      ) : null}

      {canEdit ? (
        <Button
          label="Edit request"
          icon={<Pencil color={colors.text} size={16} />}
          variant="secondary"
          onPress={() => onEdit?.()}
        />
      ) : null}

      {canDelete ? (
        <Button
          label="Delete request"
          icon={<Trash2 color={colors.white} size={16} />}
          variant="danger"
          onPress={() => onDelete?.()}
        />
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setVisibleVote(null)}
        transparent
        visible={visibleVote !== null}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVisibleVote(null)}>
          <Pressable style={styles.modalCard}>
            <AppText variant="heading">{selectedVoteLabel} votes</AppText>
            <ScrollView style={styles.voteList}>
              {selectedVotes.length ? (
                selectedVotes.map(vote => (
                  <View key={vote.user_id} style={styles.voterRow}>
                    <AppText>{playerName(vote.profile)}</AppText>
                    <AppText variant="small" muted>
                      @{vote.profile?.username ?? 'player'}
                    </AppText>
                  </View>
                ))
              ) : (
                <AppText muted>No one has picked this yet.</AppText>
              )}
            </ScrollView>
            <Button
              label="Close"
              onPress={() => setVisibleVote(null)}
              variant="secondary"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

function TeamLine({
  label,
  participants,
}: {
  label: string;
  participants: MatchRequestParticipant[];
}) {
  return (
    <View style={styles.teamLine}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <AppText>
        {participants.length
          ? participants.map(participant => playerName(participant.profile)).join(', ')
          : 'No players selected'}
      </AppText>
    </View>
  );
}

function VoteCount({
  label,
  value,
  tone,
  onPress,
}: {
  label: string;
  value: number;
  tone: 'green' | 'amber' | 'red';
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.voteCount, styles[tone]]}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="heading">{value}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  status: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  voteCounts: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  voteCount: {
    borderRadius: 8,
    flex: 1,
    padding: spacing.md,
  },
  green: {
    backgroundColor: colors.surfaceSuccess,
  },
  amber: {
    backgroundColor: colors.surfaceWarning,
  },
  red: {
    backgroundColor: colors.surfaceDanger,
  },
  teams: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    gap: spacing.sm,
    padding: spacing.md,
  },
  teamLine: {
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    maxHeight: '70%',
    padding: spacing.lg,
    width: '100%',
  },
  voteList: {
    maxHeight: 260,
  },
  voterRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
