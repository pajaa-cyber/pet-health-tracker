import React from 'react';
import { Pressable, View } from 'react-native';
import { BodyText } from './Typography';
import { colors, spacing, radii } from '../../theme/theme';

interface PermissionBarProps {
  message: string;
  onPress: () => void;
}

export function PermissionBar({ message, onPress }: PermissionBarProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View style={{ backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm }}>
        <BodyText style={{ color: '#FFFFFF', fontWeight: '600' }}>{message}</BodyText>
      </View>
    </Pressable>
  );
}
