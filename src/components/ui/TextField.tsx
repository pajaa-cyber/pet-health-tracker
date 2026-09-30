import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../../theme/theme';
import { useScrollToInputOnFocus, useScrollToEndOnFocus } from './ScrollToInputContext';

interface TextFieldProps extends TextInputProps {
  label?: string;
  // For a field that's part of a cluster sitting right above a submit
  // button (e.g. one row in a repeatable group, with "Save" right after) —
  // scrolls to the end of the form on focus instead of to just this field,
  // so the button doesn't end up hidden below the keyboard. See
  // ScrollToInputContext's useScrollToEndOnFocus for the full rationale.
  scrollToEnd?: boolean;
}

export function TextField({ label, style, onFocus, onBlur, scrollToEnd, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const scrollToInput = useScrollToInputOnFocus();
  const scrollToBottom = useScrollToEndOnFocus();

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, focused && styles.inputFocused, style]}
        onFocus={(e) => {
          setFocused(true);
          if (scrollToEnd) {
            scrollToBottom();
          } else {
            scrollToInput(e.target as any);
          }
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
});
