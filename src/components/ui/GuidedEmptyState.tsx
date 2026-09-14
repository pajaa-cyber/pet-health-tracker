import React from 'react';
import { View } from 'react-native';
import { Title, BodyText, MutedText } from './Typography';
import { Button } from './Button';
import { spacing } from '../../theme/theme';

interface GuidedEmptyStateProps {
  emoji: string;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function GuidedEmptyState({ emoji, title, message, actionLabel, onAction }: GuidedEmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
      <Title style={{ fontSize: 48 }}>{emoji}</Title>
      <BodyText style={{ fontWeight: '700', textAlign: 'center' }}>{title}</BodyText>
      <MutedText style={{ textAlign: 'center' }}>{message}</MutedText>
      <Button title={actionLabel} onPress={onAction} />
    </View>
  );
}
