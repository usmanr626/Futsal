import React from 'react';
import {Pressable, StyleSheet} from 'react-native';

import {colors, radius, spacing} from '../../theme/theme';
import {AppText} from './AppText';

type StatPillProps = {
  label: string;
  value: string | number;
  tone?: 'red' | 'blue' | 'green' | 'neutral';
  onPress?: () => void;
};

export function StatPill({label, value, tone = 'neutral', onPress}: StatPillProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({pressed}) => [
        styles.wrap,
        styles[tone],
        pressed && styles.pressed,
      ]}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    flex: 1,
    minWidth: 96,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.72,
  },
  neutral: {
    backgroundColor: colors.surfaceAlt,
  },
  red: {
    backgroundColor: colors.surfaceDanger,
  },
  blue: {
    backgroundColor: colors.surfaceInfo,
  },
  green: {
    backgroundColor: colors.surfaceSuccess,
  },
});
