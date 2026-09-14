import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs } from '../pets/weightLogService';
import { subscribeToPets, updatePetPhoto, updatePetColor } from '../pets/petService';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { Pet } from '../types/pet';
import { WeightTrendChart } from '../pets/WeightTrendChart';
import { ScreenContainer, Card, Subtitle, AvatarPicker } from '../components/ui';
import { colors, spacing } from '../theme/theme';
import { PET_COLORS } from '../theme/petColors';

const SPECIES_EMOJI: Record<string, string> = { dog: '🐶', cat: '🐱', other: '🐾' };

const SECTIONS = [
  { key: 'VaccineList', label: 'Vaccines', emoji: '💉' },
  { key: 'MedicationList', label: 'Medications', emoji: '💊' },
  { key: 'VetVisitList', label: 'Vet Visits', emoji: '🩺' },
  { key: 'WeightLog', label: 'Weight', emoji: '⚖️' },
  { key: 'ExpenseList', label: 'Expenses', emoji: '💰' },
];

export function PetHomeScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToWeightLogs(firestore, household.id, petId, setWeightLogs);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household, petId]);

  return (
    <ScreenContainer scroll>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        {household && (
          <AvatarPicker
            photoUri={pet?.photoUrl ?? null}
            fallbackEmoji={pet ? SPECIES_EMOJI[pet.species] : '🐾'}
            onPicked={(dataUri) => updatePetPhoto(firestore, household.id, petId, dataUri)}
          />
        )}
        {pet && <Subtitle>{pet.name}</Subtitle>}
        {household && pet && (
          <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
            {PET_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => updatePetColor(firestore, household.id, petId, c)}
                style={{
                  width: 28, height: 28, borderRadius: 14, backgroundColor: c,
                  borderWidth: pet.colorKey === c ? 3 : 0, borderColor: colors.text,
                }}
              />
            ))}
          </View>
        )}
      </View>
      <Card>
        <WeightTrendChart logs={weightLogs} />
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {SECTIONS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => navigation.navigate(s.key, { petId })}
            style={{ width: '47%' }}
          >
            <Card style={{ alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surfaceTint }}>
              <Subtitle style={{ fontSize: 28 }}>{s.emoji}</Subtitle>
              <Subtitle>{s.label}</Subtitle>
            </Card>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}
