import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { setWeightUnit } from '../household/householdService';
import { firestore } from '../firebase/config';
import { ScreenContainer, RecordListHeader, Chip } from '../components/ui';
import { shell, text, spacing, radii } from '../theme/theme';
import { WeightUnit } from '../pets/units';

export function PreferencesScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [saving, setSaving] = useState(false);
  const unit: WeightUnit = household?.weightUnit ?? 'kg';

  const choose = async (next: WeightUnit) => {
    if (!household || next === unit) return;
    setSaving(true);
    try {
      await setWeightUnit(firestore, household.id, next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer noPadding background={shell.bg}>
      <RecordListHeader title="Preferences" onBack={() => navigation.goBack()} />
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <View style={{ borderRadius: radii.lg, backgroundColor: shell.card, padding: 16, gap: spacing.sm }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>Weight unit</Text>
          <Text style={{ fontSize: 13, color: text.secondary }}>
            Changes how weight is shown throughout the app. Past entries aren't affected.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <Chip label="Kilograms (kg)" selected={unit === 'kg'} onPress={() => choose('kg')} />
            <Chip label="Pounds (lb)" selected={unit === 'lb'} onPress={() => choose('lb')} />
          </View>
          {saving && <Text style={{ fontSize: 12, color: text.secondary }}>Saving…</Text>}
        </View>
      </View>
    </ScreenContainer>
  );
}
