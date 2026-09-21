import React from 'react';
import { View } from 'react-native';
import { Title, BodyText, MutedText } from './Typography';
import { Button } from './Button';
import { spacing, shell, text } from '../../theme/theme';

interface GuidedEmptyStateProps {
  emoji: string;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  variant?: 'light' | 'dark';
}

export function GuidedEmptyState({ emoji, title, message, actionLabel, onAction, variant = 'light' }: GuidedEmptyStateProps) {
  const dark = variant === 'dark';

  const content = (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: dark ? 0 : spacing.xl }}>
      <Title style={{ fontSize: 48 }}>{emoji}</Title>
      {dark ? (
        <BodyText style={{ fontWeight: '700', textAlign: 'center', color: text.primary }}>{title}</BodyText>
      ) : (
        <BodyText style={{ fontWeight: '700', textAlign: 'center' }}>{title}</BodyText>
      )}
      {dark ? (
        <MutedText style={{ textAlign: 'center', color: text.secondary }}>{message}</MutedText>
      ) : (
        <MutedText style={{ textAlign: 'center' }}>{message}</MutedText>
      )}
      <Button title={actionLabel} onPress={onAction} />
    </View>
  );

  if (!dark) return content;

  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: shell.card,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: shell.cardBorderDashed,
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {content}
    </View>
  );
}
