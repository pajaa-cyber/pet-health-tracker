import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToBloodTests, deleteBloodTest } from '../pets/bloodTestService';
import { subscribeToPets } from '../pets/petService';
import { summarizeBloodTest } from '../pets/bloodTestAnalysis';
import { firestore } from '../firebase/config';
import { BloodTest } from '../types/bloodTest';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton, GuidedEmptyState } from '../components/ui';
import { shell, text, spacing, colors } from '../theme/theme';

function SummaryDot({ count, color }: { count: number; color: string }) {
  if (count === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: text.secondary }}>{count}</Text>
    </View>
  );
}

export function BloodTestListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [bloodTests, setBloodTests] = useState<BloodTest[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToBloodTests(firestore, household.id, petId, setBloodTests);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const rail = pet ? petColor(pet) : shell.control;
  const sorted = [...bloodTests].sort((a, b) => b.testDate - a.testDate);

  const handleDelete = (bloodTestId: string) => {
    if (!household) return;
    Alert.alert('Delete this blood test?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBloodTest(firestore, household.id, petId, bloodTestId) },
    ]);
  };

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Blood tests"
        subtitle={`${pet?.name ?? 'Pet'} · ${bloodTests.length} ${bloodTests.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={sorted}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => {
          const summary = summarizeBloodTest(item.results);
          return (
            <Pressable onPress={() => navigation.navigate('BloodTestDetail', { petId, bloodTestId: item.id })}>
              <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
                <View style={{ width: 6, backgroundColor: rail }} />
                <View style={{ flex: 1, padding: 14, gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>
                    {new Date(item.testDate).toLocaleDateString()}
                  </Text>
                  {!!item.laboratory && (
                    <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>{item.laboratory}</Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 2 }}>
                    <SummaryDot count={summary.high} color="#DC2626" />
                    <SummaryDot count={summary.low} color="#F59E0B" />
                    <SummaryDot count={summary.normal} color="#059669" />
                    <SummaryDot count={summary.unknown} color="rgba(255,255,255,0.3)" />
                  </View>
                </View>
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete blood test from ${new Date(item.testDate).toLocaleDateString()}`}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={{ paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="🧪"
            title="No blood tests logged yet"
            message="Add results from a lab report to track markers over time and get a plain-language explanation of what each one is."
            variant="dark"
          />
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add a blood test" onPress={() => navigation.navigate('AddBloodTest', { petId })} />
      </View>
    </ScreenContainer>
  );
}
