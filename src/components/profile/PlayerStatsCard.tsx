import React from 'react';
import {StyleSheet, View} from 'react-native';

import {colors, spacing} from '../../theme/theme';
import type {PlayerStats} from '../../types/domain';
import {formatDate} from '../../utils/date';
import {AppText} from '../ui/AppText';
import {Card} from '../ui/Card';
import {StatPill} from '../ui/StatPill';

type PlayerStatsCardProps = {
  stats: PlayerStats | null;
};

export function PlayerStatsCard({stats}: PlayerStatsCardProps) {
  return (
    <Card style={styles.card}>
      <AppText variant="heading">Player stats</AppText>
      {stats ? (
        <>
          <View style={styles.pills}>
            <StatPill label="Matches" value={stats.matches_played} />
            <StatPill label="Goals" value={stats.goals} tone="green" />
            <StatPill label="MOTM" value={stats.motm_count} />
          </View>
          <View style={styles.rows}>
            <View style={styles.row}>
              <AppText variant="label" muted>
                Win rate
              </AppText>
              <AppText>{stats.win_rate}%</AppText>
            </View>
            <View style={styles.row}>
              <AppText variant="label" muted>
                Last played
              </AppText>
              <AppText>
                {stats.last_played_at ? formatDate(stats.last_played_at) : 'Not yet'}
              </AppText>
            </View>
          </View>
        </>
      ) : (
        <AppText muted>Loading player stats...</AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rows: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  row: {
    gap: spacing.xs,
  },
});
