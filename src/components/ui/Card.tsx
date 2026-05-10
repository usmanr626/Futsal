import type {ReactNode} from 'react';
import React from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';

import {colors, radius, spacing} from '../../theme/theme';

type CardProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function Card({children, style}: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
});
