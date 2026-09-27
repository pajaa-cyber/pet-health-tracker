import React, { useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { setWeightUnit } from '../household/householdService';
import { firestore } from '../firebase/config';
import { ScreenContainer, Button, Title, MutedText } from '../components/ui';
import { spacing } from '../theme/theme';
import { WeightUnit } from '../pets/units';

export function WeightUnitSetupScreen() {
  const { household } = useHousehold();
  const [saving, setSaving] = useState<WeightUnit | null>(null);

  const choose = async (unit: WeightUnit) => {
    if (!household) return;
    setSaving(unit);
    await setWeightUnit(firestore, household.id, unit);
  };

  return (
    <ScreenContainer style={{ justifyContent: 'center', flexGrow: 1 }}>
      <Title style={{ marginBottom: spacing.sm }}>Kilograms or pounds?</Title>
      <MutedText style={{ marginBottom: spacing.md }}>
        Choose how weight is shown throughout the app. You can change this later in Settings.
      </MutedText>
      <Button title="Kilograms (kg)" onPress={() => choose('kg')} loading={saving === 'kg'} disabled={saving !== null} />
      <Button
        title="Pounds (lb)"
        variant="outline"
        onPress={() => choose('lb')}
        loading={saving === 'lb'}
        disabled={saving !== null}
      />
    </ScreenContainer>
  );
}
