import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {colors, radius, spacing} from '../../theme/theme';
import {AppText} from './AppText';

type Option<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.wrap}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.selected]}>
            <AppText
              variant="small"
              style={[styles.optionText, selected && styles.selectedText]}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  option: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.primary,
  },
  optionText: {
    color: colors.textMuted,
    fontWeight: '800',
  },
  selectedText: {
    color: colors.onPrimary,
  },
});
