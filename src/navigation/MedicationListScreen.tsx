import React, { useEffect, useState } from 'react';
import { FlatList, View, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToMedications, logMedicationDose, skipMedicationDose } from '../pets/medicationService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Medication } from '../types/medication';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton, Button, ErrorText } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function MedicationListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { user } = useAuth();
  const { household } = useHousehold();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToMedications(firestore, household.id, petId, setMedications);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const handleMarkGiven = async (medicationId: string) => {
    if (!household || !user) return;
    setError(null);
    try {
      await logMedicationDose(firestore, household.id, petId, medicationId, user.uid);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSkip = async (medicationId: string) => {
    if (!household || !user) return;
    setError(null);
    try {
      await skipMedicationDose(firestore, household.id, petId, medicationId, user.uid);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const displayNameFor = (userId: string) =>
    household?.members.find((m) => m.userId === userId)?.displayName ?? userId;

  const rail = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Medications"
        subtitle={`${pet?.name ?? 'Pet'} · ${medications.length} ${medications.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      {error && (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorText>{error}</ErrorText>
        </View>
      )}
      <FlatList
        data={medications}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => {
          const lastAction = item.log.length > 0 ? item.log[item.log.length - 1] : null;
          return (
            <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
              <View style={{ width: 6, backgroundColor: rail }} />
              <View style={{ flex: 1, padding: 14, gap: spacing.xs }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{item.name} — {item.dosage}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  {item.schedule.timesPerDay}x/day, every {item.schedule.intervalDays}d
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  {lastAction
                    ? `${lastAction.skipped ? 'Last skipped' : 'Last given'}: ${new Date(lastAction.givenAt).toLocaleString()} by ${displayNameFor(lastAction.givenBy)}`
                    : 'No doses logged yet'}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  <Button title="Mark dose as given" variant="accent" onPress={() => handleMarkGiven(item.id)} style={{ flex: 1 }} />
                  <Button
                    title="Skip this dose"
                    variant="outline"
                    borderColor="rgba(255,255,255,0.25)"
                    textColor={text.primary}
                    onPress={() => handleSkip(item.id)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: text.secondary, fontSize: 14, textAlign: 'center', paddingTop: spacing.xl }}>
            No medications yet.
          </Text>
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add a medication" onPress={() => navigation.navigate('AddMedication', { petId })} />
      </View>
    </ScreenContainer>
  );
}
