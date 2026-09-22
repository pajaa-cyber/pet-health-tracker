import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, PressableProps, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme/theme';

type Variant = 'primary' | 'accent' | 'outline' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
  bg?: string;
  textColor?: string;
  borderColor?: string;
  fontSize?: number;
}

const variantStyles: Record<Variant, { bg: string; border?: string; text: string }> = {
  primary: { bg: colors.primary, text: '#FFFFFF' },
  accent: { bg: colors.accent, text: colors.accentText },
  outline: { bg: 'transparent', border: colors.primary, text: colors.primary },
  danger: { bg: colors.danger, text: '#FFFFFF' },
};

export function Button({ title, variant = 'primary', loading, disabled, style, bg, textColor, borderColor, fontSize, ...rest }: ButtonProps) {
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  const resolvedBg = bg ?? v.bg;
  const resolvedBorder = borderColor ?? v.border;
  const resolvedText = textColor ?? v.text;
  const resolvedFontSize = fontSize ?? styles.text.fontSize;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: resolvedBg,
          borderColor: resolvedBorder ?? 'transparent',
          borderWidth: resolvedBorder ? 1.5 : 0,
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={resolvedText} /> : <Text style={[styles.text, { color: resolvedText, fontSize: resolvedFontSize }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
