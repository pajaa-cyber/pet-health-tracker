import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToBloodTests, deleteBloodTest } from '../pets/bloodTestService';
import { subscribeToPets } from '../pets/petService';
import {
  summarizeBloodTest,
  notableResults,
  computeMarkerStatus,
  generateVetQuestions,
  markerTrend,
  describeTrend,
  MarkerStatus,
} from '../pets/bloodTestAnalysis';
import { lookupBloodMarker } from '../pets/bloodMarkerGlossary';
import { firestore } from '../firebase/config';
import { BloodTest, BloodMarkerResult } from '../types/bloodTest';
import { Pet } from '../types/pet';
import { ScreenContainer, Button, Title, MutedText, BodyText } from '../components/ui';
import { spacing, colors, radii } from '../theme/theme';

const STATUS_COLOR: Record<MarkerStatus, string> = {
  high: '#DC2626',
  low: '#D97706',
  normal: '#059669',
  unknown: colors.textMuted,
};
const STATUS_LABEL: Record<MarkerStatus, string> = {
  high: 'Above range',
  low: 'Below range',
  normal: 'Within range',
  unknown: 'Not interpreted',
};

function MarkerRow({ result, allTests }: { result: BloodMarkerResult; allTests: BloodTest[] }) {
  const status = computeMarkerStatus(result);
  const info = lookupBloodMarker(result.marker);
  const label = info?.name ?? result.marker;
  const trend = markerTrend(allTests, result.marker);
  const direction = trend.length > 1 ? describeTrend(trend) : null;

  return (
    <View style={{ borderRadius: radii.md, backgroundColor: colors.surfaceTint, padding: spacing.md, gap: 4 }}>
      {/* flexShrink on the marker name — it falls back to the raw
          user-typed/OCR'd marker string (result.marker) when it's not one
          of the ~25 known glossary entries, which has no length limit on
          manual entry. Same defensive shape as the Home/Household-screen
          fix: don't let unbounded text push the status badge away. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text, flexShrink: 1, marginRight: spacing.sm }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ fontWeight: '700', fontSize: 12, color: STATUS_COLOR[status], flexShrink: 0 }}>{STATUS_LABEL[status]}</Text>
      </View>
      <Text style={{ color: colors.text }}>
        {result.value} {result.unit}
        {result.referenceLow != null && result.referenceHigh != null
          ? `  (reference ${result.referenceLow}–${result.referenceHigh})`
          : ''}
      </Text>
      {info ? (
        <MutedText>{info.description}</MutedText>
      ) : (
        <MutedText>No description available for this marker.</MutedText>
      )}
      {direction && direction !== 'insufficient data' && (
        <MutedText>
          {label} has {direction} across the {trend.length} recorded tests — the numbers alone, not a
          clinical read.
        </MutedText>
      )}
    </View>
  );
}

export function BloodTestDetailScreen({ route, navigation }: any) {
  const { petId, bloodTestId } = route.params;
  const { household } = useHousehold();
  const [bloodTests, setBloodTests] = useState<BloodTest[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const pet = pets.find((p) => p.id === petId);
  const bloodTest = bloodTests.find((t) => t.id === bloodTestId);

  useEffect(() => {
    if (!household) return;
    return subscribeToBloodTests(firestore, household.id, petId, setBloodTests);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const handleDelete = () => {
    if (!household) return;
    Alert.alert('Delete this blood test?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBloodTest(firestore, household.id, petId, bloodTestId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!bloodTest) {
    return (
      <ScreenContainer>
        <MutedText>Loading…</MutedText>
      </ScreenContainer>
    );
  }

  const summary = summarizeBloodTest(bloodTest.results);
  const notable = notableResults(bloodTest.results);
  const questions = generateVetQuestions(bloodTest.results);

  return (
    <ScreenContainer scroll>
      <Title>{new Date(bloodTest.testDate).toLocaleDateString()}</Title>
      {!!bloodTest.laboratory && <MutedText>{bloodTest.laboratory}</MutedText>}

      <View style={{ borderRadius: radii.md, backgroundColor: colors.surfaceTint, padding: spacing.md, gap: 4 }}>
        <BodyText style={{ fontWeight: '800' }}>{summary.total} markers detected</BodyText>
        {summary.high > 0 && <BodyText>🔴 {summary.high} above reference range</BodyText>}
        {summary.low > 0 && <BodyText>🟡 {summary.low} below reference range</BodyText>}
        {summary.normal > 0 && <BodyText>🟢 {summary.normal} within reference range</BodyText>}
        {summary.unknown > 0 && <BodyText>⚪ {summary.unknown} not interpreted (no reference range entered)</BodyText>}
      </View>

      {notable.length > 0 && (
        <>
          <Title>Notable results</Title>
          {notable.map((r, i) => (
            <MarkerRow key={i} result={r} allTests={bloodTests} />
          ))}
        </>
      )}

      <Title>All results</Title>
      {bloodTest.results.map((r, i) => (
        <MarkerRow key={i} result={r} allTests={bloodTests} />
      ))}

      {questions.length > 0 && (
        <>
          <Title>Questions for your veterinarian</Title>
          <View style={{ gap: 4 }}>
            {questions.map((q, i) => (
              <BodyText key={i}>
                {i + 1}. {q}
              </BodyText>
            ))}
          </View>
        </>
      )}

      <MutedText style={{ fontSize: 11 }}>
        This screen only compares each value against the reference range entered — it's not a medical
        interpretation. Always discuss results with {pet?.name ?? 'your pet'}'s veterinarian.
      </MutedText>

      <Button title="Delete this blood test" variant="danger" onPress={handleDelete} />
    </ScreenContainer>
  );
}
