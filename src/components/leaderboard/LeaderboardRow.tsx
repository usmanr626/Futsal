import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {colors, spacing} from '../../theme/theme';
import type {LeaderboardRowData} from '../../types/domain';
import {playerName} from '../../utils/player';
import {ProfileAvatar} from '../profile/ProfileAvatar';
import {AppText} from '../ui/AppText';

type LeaderboardRowProps = {
  row: LeaderboardRowData;
  rank: number;
  metricLabel: string;
  metricValue: string | number;
  onPress: () => void;
};

export function LeaderboardRow({
  row,
  rank,
  metricLabel,
  metricValue,
  onPress,
}: LeaderboardRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rank}>
        <ProfileAvatar profile={row} size={36} />
      </View>
      <View style={styles.player}>
        <AppText>{playerName(row)}</AppText>
        <AppText variant="small" muted>
          #{rank} · @{row.username}
        </AppText>
      </View>
      <View style={styles.metric}>
        <AppText variant="heading">{metricValue}</AppText>
        <AppText variant="label" muted>
          {metricLabel}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  rank: {
    alignItems: 'center',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  player: {
    flex: 1,
  },
  metric: {
    alignItems: 'flex-end',
  },
});
