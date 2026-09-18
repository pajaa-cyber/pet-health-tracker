import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Image, View, Text, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToMedications } from '../pets/medicationService';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { subscribeToWeightLogs } from '../pets/weightLogService';
import { subscribeToExpenses } from '../pets/expenseService';
import { useUpcomingReminders } from '../reminders/useUpcomingReminders';
import { usePetSelection, reconcileSelection } from '../selection/PetSelectionContext';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Medication } from '../types/medication';
import { VetVisit } from '../types/vetVisit';
import { WeightLog } from '../types/weightLog';
import { Expense } from '../types/expense';
import { ScreenContainer, Button, PetSelector } from '../components/ui';
import { shell, text, accentLavender, spacing, radii } from '../theme/theme';
import { petColor, onPetColorInk } from '../theme/petColors';
import { SPECIES_EMOJI, speciesDisplay } from '../pets/species';

function formatEuros(cents: number): string {
  const value = cents / 100;
  return Number.isInteger(value) ? `€${value}` : `€${value.toFixed(2)}`;
}

function daysUntil(dueDate: number): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.ceil((dueDate - Date.now()) / DAY_MS);
}

function DueStripCard({ reminder, pet }: { reminder: ReturnType<typeof useUpcomingReminders>[number]; pet: Pet }) {
  const bg = reminder.overdue ? '#DC2626' : petColor(pet);
  const ink = onPetColorInk(bg);
  const n = daysUntil(reminder.dueDate);
  return (
    <View style={{ minWidth: 168, borderRadius: 18, padding: 12, paddingTop: 14, backgroundColor: bg, gap: 4 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', color: ink, opacity: 0.8 }}>
        {reminder.overdue ? 'OVERDUE' : `IN ${n} DAY${n === 1 ? '' : 'S'}`}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: '800', color: ink }}>{reminder.label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: ink, opacity: 0.85 }}>{pet.name}</Text>
    </View>
  );
}

function PetCard({ pet, navigation, nextDue }: { pet: Pet; navigation: any; nextDue: ReturnType<typeof useUpcomingReminders>[number] | undefined }) {
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [vetVisits, setVetVisits] = useState<VetVisit[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const { household } = useHousehold();
  const anim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!household) return;
    const unsubs = [
      subscribeToVaccines(firestore, household.id, pet.id, setVaccines),
      subscribeToMedications(firestore, household.id, pet.id, setMedications),
      subscribeToVetVisits(firestore, household.id, pet.id, setVetVisits),
      subscribeToWeightLogs(firestore, household.id, pet.id, setWeightLogs),
      subscribeToExpenses(firestore, household.id, pet.id, setExpenses),
    ];
    return () => unsubs.forEach((u) => u());
  }, [household, pet.id]);

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [anim]);

  const recordsCount = vaccines.length + medications.length + vetVisits.length;
  const latestWeight = [...weightLogs].sort((a, b) => b.date - a.date)[0]?.weight ?? null;
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const yearSpendCents = expenses.filter((e) => e.date >= yearStart).reduce((sum, e) => sum + e.amountCents, 0);

  const color = petColor(pet);
  const overdue = nextDue?.overdue ?? false;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
        ],
      }}
    >
      <Pressable
        onPress={() => navigation.navigate('PetHome', { petId: pet.id })}
        accessibilityRole="button"
        accessibilityLabel={pet.name}>
        <View style={{ borderRadius: 26, padding: 18, backgroundColor: shell.card, borderLeftWidth: 5, borderLeftColor: color, overflow: 'hidden' }}>
          <Text style={{ position: 'absolute', right: -6, top: -14, fontSize: 104, opacity: 0.08 }}>
            {SPECIES_EMOJI[pet.species] ?? '🐾'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: shell.onColour, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {pet.photoUrl ? (
                <Image source={{ uri: pet.photoUrl }} style={{ width: 56, height: 56 }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 27 }}>{SPECIES_EMOJI[pet.species] ?? '🐾'}</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: text.primary }}>{pet.name}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: text.secondary }}>
                {speciesDisplay(pet)}{pet.breed ? ` · ${pet.breed}` : ''}{pet.birthDate != null ? ` · ${Math.floor((Date.now() - pet.birthDate) / (365.25 * 24 * 60 * 60 * 1000))} yr` : ''}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>
            <View
              style={{
                borderRadius: radii.pill, paddingVertical: 8, paddingHorizontal: 14,
                backgroundColor: nextDue == null ? shell.onColour : overdue ? '#FFFFFF' : color,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: nextDue == null ? text.primary : overdue ? '#DC2626' : onPetColorInk(color) }}>
                {nextDue == null ? '✅ Nothing due — all clear' : overdue ? `⚠️ ${nextDue.label} overdue` : `⏰ ${nextDue.label} in ${daysUntil(nextDue.dueDate)} days`}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 1, borderRadius: 14, backgroundColor: shell.onColour, paddingVertical: 9, paddingHorizontal: 11, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{latestWeight != null ? `${latestWeight} kg` : '—'}</Text>
              <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>Weight</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 14, backgroundColor: shell.onColour, paddingVertical: 9, paddingHorizontal: 11, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{recordsCount}</Text>
              <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>Records</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 14, backgroundColor: shell.onColour, paddingVertical: 9, paddingHorizontal: 11, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{formatEuros(yearSpendCents)}</Text>
              <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>Spend</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={{ borderRadius: 26, backgroundColor: shell.card, borderWidth: 2, borderColor: shell.cardBorderDashed, borderStyle: 'dashed', alignItems: 'center', padding: spacing.xl, gap: spacing.sm }}>
      <Text style={{ fontSize: 44 }}>🐾</Text>
      <Text style={{ fontSize: 19, fontWeight: '800', color: text.primary }}>No pets here yet</Text>
      <Text style={{ fontSize: 13, lineHeight: 19, color: text.secondary, textAlign: 'center', maxWidth: 220 }}>
        Add your first one and everyone in the household sees it straight away.
      </Text>
      <Button title="Add a pet" variant="accent" onPress={onAdd} style={{ borderRadius: radii.pill, minHeight: 48 }} />
    </View>
  );
}

export function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { selectedPetId, setSelectedPetId } = usePetSelection();
  const [pets, setPets] = useState<Pet[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    reconcileSelection(selectedPetId, pets.map((p) => p.id), setSelectedPetId);
  }, [pets, selectedPetId, setSelectedPetId]);

  const visiblePets = selectedPetId === 'all' ? pets : pets.filter((p) => p.id === selectedPetId);
  const reminders = useUpcomingReminders(visiblePets);
  const firstName = (user?.email ?? 'there').split('@')[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const initial = displayName.charAt(0).toUpperCase();

  const nextDueForPet = (petId: string) => reminders.find((r) => r.petId === petId);

  return (
    <ScreenContainer style={{ flex: 1, gap: spacing.md, paddingTop: spacing.md + insets.top }} background={shell.bg}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          {household && (
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2.2, textTransform: 'uppercase', color: accentLavender }}>
              {household.name.trim().toUpperCase()} HOUSEHOLD
            </Text>
          )}
          <Text style={{ fontSize: 27, fontWeight: '800', color: text.primary, lineHeight: 30 }}>Hey {displayName} 👋</Text>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>{initial}</Text>
        </View>
      </View>

      {pets.length > 0 && <PetSelector pets={pets} variant="dark" />}

      {reminders.length > 0 && (
        <FlatList
          horizontal
          style={{ flexGrow: 0 }}
          showsHorizontalScrollIndicator={false}
          data={reminders}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => {
            const pet = visiblePets.find((p) => p.id === item.petId);
            return pet ? <DueStripCard reminder={item} pet={pet} /> : null;
          }}
        />
      )}

      <FlatList
        style={{ flex: 1 }}
        data={visiblePets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: spacing.md }}
        renderItem={({ item }) => <PetCard pet={item} navigation={navigation} nextDue={nextDueForPet(item.id)} />}
        ListEmptyComponent={<EmptyState onAdd={() => navigation.navigate('AddPet')} />}
      />
    </ScreenContainer>
  );
}
