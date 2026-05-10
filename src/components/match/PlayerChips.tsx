import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {colors, radius, spacing} from '../../theme/theme';
import type {Profile} from '../../types/domain';
import {playerName} from '../../utils/player';
import {AppText} from '../ui/AppText';

type PlayerChipsProps = {
  profiles: Profile[];
  selectedIds: string[];
  onToggle: (profileId: string) => void;
};

export function PlayerChips({profiles, selectedIds, onToggle}: PlayerChipsProps) {
  return (
    <View style={styles.wrap}>
      {profiles.map(profile => {
        const selected = selectedIds.includes(profile.id);

        return (
          <Pressable
            key={profile.id}
            onPress={() => onToggle(profile.id)}
            style={[styles.chip, selected && styles.selectedChip]}>
            <AppText
              variant="small"
              style={selected ? styles.selectedText : undefined}>
              {playerName(profile)}
            </AppText>
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
  selectedChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectedText: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
});
