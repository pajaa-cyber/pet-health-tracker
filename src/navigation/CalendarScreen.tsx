import React from 'react';
import { ScreenContainer, Title, MutedText } from '../components/ui';
import { spacing } from '../theme/theme';

export function CalendarScreen() {
  return (
    <ScreenContainer style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm }}>
      <Title>📅</Title>
      <Title>Calendar is coming soon</Title>
      <MutedText style={{ textAlign: 'center' }}>
        Every reminder and appointment for your pets will show up here, filterable by pet.
      </MutedText>
    </ScreenContainer>
  );
}
