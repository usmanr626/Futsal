import React from 'react';
import {StyleSheet, View} from 'react-native';

import {colors, radius, spacing} from '../../theme/theme';
import {AppText} from './AppText';

type EmptyStateProps = {
  title: string;
  body?: string;
};

export function EmptyState({title, body}: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <AppText variant="heading">{title}</AppText>
      {body ? (
        <AppText muted style={styles.body}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.xl,
  },
  body: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
