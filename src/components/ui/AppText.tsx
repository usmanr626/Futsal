import type {ReactNode} from 'react';
import React from 'react';
import {StyleSheet, Text, type TextProps} from 'react-native';

import {colors, typography} from '../../theme/theme';

type AppTextProps = TextProps & {
  children: ReactNode;
  variant?: 'title' | 'heading' | 'body' | 'small' | 'label';
  muted?: boolean;
};

export function AppText({
  children,
  variant = 'body',
  muted = false,
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[styles.base, styles[variant], muted && styles.muted, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
    fontWeight: '500',
    letterSpacing: 0,
  },
  title: {
    fontSize: typography.title,
    lineHeight: 34,
    fontWeight: '800',
  },
  heading: {
    fontSize: typography.heading,
    lineHeight: 26,
    fontWeight: '800',
  },
  body: {
    fontSize: typography.body,
    lineHeight: 21,
  },
  small: {
    fontSize: typography.small,
    lineHeight: 17,
  },
  label: {
    fontSize: typography.tiny,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  muted: {
    color: colors.textMuted,
  },
});
