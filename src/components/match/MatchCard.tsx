import {CalendarDays, MapPin} from 'lucide-react-native';
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {colors, spacing} from '../../theme/theme';
import type {Match} from '../../types/domain';
import {formatDateTime} from '../../utils/date';
import {hasMatchPassed, isScheduledMatch} from '../../utils/match';
import {playerName} from '../../utils/player';
import {AppText} from '../ui/AppText';
import {Card} from '../ui/Card';

type MatchCardProps = {
  match: Match;
  onPress: () => void;
};

export function MatchCard({match, onPress}: MatchCardProps) {
  const hasScore = match.team_a_score !== null && match.team_b_score !== null;
  const statusLabel =
    isScheduledMatch(match) && hasMatchPassed(match) ? 'previous' : match.status;

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View>
            <AppText variant="label" muted>
              {statusLabel}
            </AppText>
            <AppText variant="heading">{match.title}</AppText>
          </View>
          {hasScore ? (
            <View style={styles.scoreBox}>
              <AppText variant="heading" style={styles.scoreText}>
                {match.team_a_score}-{match.team_b_score}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <CalendarDays color={colors.textMuted} size={16} />
          <AppText muted>{formatDateTime(match.match_date)}</AppText>
        </View>

        {match.venue ? (
          <View style={styles.metaRow}>
            <MapPin color={colors.textMuted} size={16} />
            <AppText muted>{match.venue}</AppText>
          </View>
        ) : null}

        <View style={styles.teams}>
          <View style={[styles.teamStripe, styles.red]} />
          <AppText>{match.team_a_name}</AppText>
          <View style={styles.vs}>
            <AppText variant="label" muted>
              vs
            </AppText>
          </View>
          <View style={[styles.teamStripe, styles.blue]} />
          <AppText>{match.team_b_name}</AppText>
        </View>

        {match.motm ? (
          <View style={styles.motm}>
            <AppText variant="label" muted>
              MOTM
            </AppText>
            <AppText>{playerName(match.motm)}</AppText>
          </View>
        ) : null}
      </Card>
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
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  scoreBox: {
    alignItems: 'center',
    backgroundColor: colors.black,
    borderRadius: 8,
    minWidth: 70,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scoreText: {
    color: colors.white,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  teams: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  teamStripe: {
    borderRadius: 4,
    height: 16,
    width: 4,
  },
  red: {
    backgroundColor: colors.red,
  },
  blue: {
    backgroundColor: colors.blue,
  },
  vs: {
    marginHorizontal: spacing.xs,
  },
  motm: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    gap: spacing.xs,
    padding: spacing.md,
  },
});
