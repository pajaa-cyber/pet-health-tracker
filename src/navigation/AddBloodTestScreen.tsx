import React, { useState } from 'react';
import { View } from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useHousehold } from '../household/HouseholdContext';
import { createBloodTest } from '../pets/bloodTestService';
import { pickImage } from '../pets/imageUpload';
import { parseBloodTestText } from '../pets/bloodTestOcr';
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
const isRowEmpty = (r: MarkerRow) => !r.marker.trim() && !r.value.trim();

// Manual entry, optionally OCR-assisted — see bloodTestAnalysis.ts's header
// comment for the full five-layer plan this form is Layers 1-2 of. Scanning
// a photo (on-device OCR, @react-native-ml-kit/text-recognition — same
// engine as Scan Food, nothing uploaded anywhere) only pre-fills these same
// text fields; it never skips the owner reviewing/correcting/confirming
// each row before Save, and it never touches reference-range interpretation
// or marker meaning — those stay computeMarkerStatus()'s and
// bloodMarkerGlossary's jobs, unconditionally, same as manual entry. A real
// lab report's layout varies too much for OCR to be trusted further than
// that: parseBloodTestText (bloodTestOcr.ts) is deliberately best-effort
// and skips any line it can't parse cleanly rather than guessing.
export function AddBloodTestScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [testDate, setTestDate] = useState(Date.now());
  const [laboratory, setLaboratory] = useState('');
  const [rows, setRows] = useState<MarkerRow[]>([{ ...EMPTY_ROW }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  const updateRow = (i: number, patch: Partial<MarkerRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  const handleScan = async (source: 'camera' | 'library') => {
    setError(null);
    setScanning(true);
    try {
      const uri = await pickImage(source);
      if (!uri) return;
      const result = await TextRecognition.recognize(uri);
      const parsed = parseBloodTestText(result.text);
      if (parsed.length === 0) {
        setError("Couldn't read any markers from that photo — enter them below instead.");
        return;
      }
      // Keeps whatever the owner already typed, dropping only the blank
      // placeholder row(s) the form starts with — scanning never discards
      // real in-progress data.
      setRows((prev) => [...prev.filter((r) => !isRowEmpty(r)), ...parsed]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

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
        Enter the values from the lab report, or scan a photo of it to pre-fill the markers below — review and
        correct them before saving either way. Add a reference range for a marker to see whether it's high, low or
        normal — leave it blank to just record the value.
      </MutedText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title="Scan photo" onPress={() => handleScan('camera')} loading={scanning} style={{ flex: 1 }} />
        <Button title="Choose from library" variant="outline" onPress={() => handleScan('library')} style={{ flex: 1 }} />
      </View>
      <DateField label="Test date" value={testDate} onChange={setTestDate} />
      <TextField label="Laboratory (optional)" value={laboratory} onChangeText={setLaboratory} />
      <Title>Markers</Title>
      {rows.map((row, i) => {
        // Only the last row sits directly above "Add another marker"/"Save"
        // — scrolling any of its fields to the end of the form (instead of
        // just to that field) keeps the button reachable without extra
        // manual scrolling. An earlier row's fields keep the normal
        // scroll-to-self behavior so focusing them doesn't jump past
        // whatever rows come after.
        const isLastRow = i === rows.length - 1;
        return (
          <View key={i} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceTint }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField label="Marker (e.g. ALT)" value={row.marker} onChangeText={(t) => updateRow(i, { marker: t })} scrollToEnd={isLastRow} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Value" keyboardType="numeric" value={row.value} onChangeText={(t) => updateRow(i, { value: t })} scrollToEnd={isLastRow} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField label="Unit" value={row.unit} onChangeText={(t) => updateRow(i, { unit: t })} scrollToEnd={isLastRow} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Ref. low" keyboardType="numeric" value={row.referenceLow} onChangeText={(t) => updateRow(i, { referenceLow: t })} scrollToEnd={isLastRow} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Ref. high" keyboardType="numeric" value={row.referenceHigh} onChangeText={(t) => updateRow(i, { referenceHigh: t })} scrollToEnd={isLastRow} />
              </View>
            </View>
            {rows.length > 1 && <Button title="Remove marker" variant="outline" onPress={() => removeRow(i)} />}
          </View>
        );
      })}
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
