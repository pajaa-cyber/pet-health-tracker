import React from 'react';
import { ScreenContainer, Title, MutedText } from '../components/ui';
import { spacing } from '../theme/theme';

export function VetsScreen() {
  return (
    <ScreenContainer style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm }}>
      <Title>🩺</Title>
      <Title>Vets is coming soon</Title>
      <MutedText style={{ textAlign: 'center' }}>
        Save every clinic you've used, with contact details and which pets go there.
      </MutedText>
    </ScreenContainer>
  );
}
