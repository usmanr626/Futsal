import React from 'react';
import {StyleSheet, View} from 'react-native';

import {colors, radius, spacing} from '../../theme/theme';
import {AppText} from './AppText';

type StatPillProps = {
  label: string;
  value: string | number;
  tone?: 'red' | 'blue' | 'green' | 'neutral';
};

export function StatPill({label, value, tone = 'neutral'}: StatPillProps) {
  return (
    <View style={[styles.wrap, styles[tone]]}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    flex: 1,
    minWidth: 96,
    padding: spacing.md,
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
