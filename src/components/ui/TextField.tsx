import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import {colors, radius, spacing, typography} from '../../theme/theme';
import {AppText} from './AppText';

type TextFieldProps = TextInputProps & {
  label: string;
  containerStyle?: ViewStyle;
  error?: string;
};

export function TextField({
  label,
  style,
  containerStyle,
  error,
  ...props
}: TextFieldProps) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error ? (
        <AppText variant="small" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
  },
});
