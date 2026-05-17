import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {colors, radius, spacing} from '../../theme/theme';
import type {PlayerStatSummary, Profile} from '../../types/domain';
import {playerName} from '../../utils/player';
import {AppText} from '../ui/AppText';

type PlayerChipsProps = {
  profiles: Profile[];
  selectedIds: string[];
  statsByUserId?: Record<string, PlayerStatSummary>;
  onToggle: (profileId: string) => void;
};

export function PlayerChips({
  profiles,
  selectedIds,
  statsByUserId,
  onToggle,
}: PlayerChipsProps) {
  return (
    <View style={styles.wrap}>
      {profiles.map(profile => {
        const selected = selectedIds.includes(profile.id);
        const stats = statsByUserId?.[profile.id];

        return (
          <Pressable
            key={profile.id}
            onPress={() => onToggle(profile.id)}
            style={[styles.chip, selected && styles.selectedChip]}>
            <AppText
              variant="small"
              style={[styles.name, selected && styles.selectedText]}>
              {playerName(profile)}
            </AppText>
            {stats ? (
              <AppText
                variant="small"
                style={[styles.stats, selected && styles.selectedText]}>
                {stats.goals} G | {stats.matches_played} Apps | {stats.motm_count}{' '}
                MOTM
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  name: {
    fontWeight: '800',
  },
  stats: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  selectedChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectedText: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
});
