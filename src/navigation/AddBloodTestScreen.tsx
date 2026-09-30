import React, { useState } from 'react';
import { View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createBloodTest } from '../pets/bloodTestService';
import { firestore } from '../firebase/config';
import { BloodMarkerResult } from '../types/bloodTest';
import { DateField } from '../components/DateField';
import { ScreenContainer, TextField, Button, Title, MutedText, ErrorText } from '../components/ui';
import { spacing, colors, radii } from '../theme/theme';

interface MarkerRow {
  marker: string;
  value: string;
  unit: string;
  referenceLow: string;
  referenceHigh: string;
}

const EMPTY_ROW: MarkerRow = { marker: '', value: '', unit: '', referenceLow: '', referenceHigh: '' };

// Manual entry only — see bloodTestAnalysis.ts's header comment for why an
// arbitrary lab report's table isn't auto-extracted here. Layer 2 of that
// plan ("did I read this right?") IS this form: the owner types what the
// report says, one marker at a time.
export function AddBloodTestScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [testDate, setTestDate] = useState(Date.now());
  const [laboratory, setLaboratory] = useState('');
  const [rows, setRows] = useState<MarkerRow[]>([{ ...EMPTY_ROW }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateRow = (i: number, patch: Partial<MarkerRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  const canSave = rows.some((r) => r.marker.trim() && r.value.trim());

  const handleSave = async () => {
    if (!household) return;
    setError(null);
    const results: BloodMarkerResult[] = rows
      .filter((r) => r.marker.trim() && r.value.trim())
      .map((r) => ({
        marker: r.marker.trim(),
        value: parseFloat(r.value),
        unit: r.unit.trim(),
        referenceLow: r.referenceLow.trim() ? parseFloat(r.referenceLow) : null,
        referenceHigh: r.referenceHigh.trim() ? parseFloat(r.referenceHigh) : null,
      }));
    if (results.length === 0) {
      setError('Add at least one marker with a value.');
      return;
    }
    setSaving(true);
    try {
      await createBloodTest(firestore, household.id, petId, testDate, laboratory.trim(), results);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <Title>Add a blood test</Title>
      <MutedText>
        Enter the values from the lab report. Add a reference range for a marker to see whether it's high, low or
        normal — leave it blank to just record the value.
      </MutedText>
      <DateField label="Test date" value={testDate} onChange={setTestDate} />
      <TextField label="Laboratory (optional)" value={laboratory} onChangeText={setLaboratory} />
      <Title>Markers</Title>
      {rows.map((row, i) => (
        <View key={i} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceTint }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Marker (e.g. ALT)" value={row.marker} onChangeText={(t) => updateRow(i, { marker: t })} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Value" keyboardType="numeric" value={row.value} onChangeText={(t) => updateRow(i, { value: t })} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Unit" value={row.unit} onChangeText={(t) => updateRow(i, { unit: t })} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Ref. low" keyboardType="numeric" value={row.referenceLow} onChangeText={(t) => updateRow(i, { referenceLow: t })} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Ref. high" keyboardType="numeric" value={row.referenceHigh} onChangeText={(t) => updateRow(i, { referenceHigh: t })} />
            </View>
          </View>
          {rows.length > 1 && <Button title="Remove marker" variant="outline" onPress={() => removeRow(i)} />}
        </View>
      ))}
      <Button title="Add another marker" variant="outline" onPress={addRow} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Save" onPress={handleSave} loading={saving} disabled={!canSave} />
      {/* This form's content sits right at one screen's height without a
          keyboard open, which left the ScrollView unable to reliably become
          scrollable once the keyboard actually opened and covered the
          Marker/Value/Ref fields — found live on-device, not by review.
          A fixed spacer guarantees content is always taller than any
          visible area, so scrolling stays consistently available. */}
      <View style={{ height: 280 }} />
    </ScreenContainer>
  );
}
