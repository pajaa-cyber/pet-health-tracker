// src/navigation/PetHomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Pressable, Text, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs } from '../pets/weightLogService';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToMedications } from '../pets/medicationService';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { subscribeToExpenses } from '../pets/expenseService';
import { subscribeToDocuments } from '../documents/documentService';
import { subscribeToPets, updatePetPhoto, updatePetColor, updatePet } from '../pets/petService';
import { subscribeToVets } from '../vets/vetService';
import { generatePassport } from '../documents/passportService';
import { canGeneratePassport, passportLimitMessage } from '../limits/limits';
import { usePetSelection } from '../selection/PetSelectionContext';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { Vaccine } from '../types/vaccine';
import { Medication } from '../types/medication';
import { VetVisit } from '../types/vetVisit';
import { Expense, ExpenseCategory } from '../types/expense';
import { Document } from '../types/document';
import { Vet } from '../types/vet';
import { Pet } from '../types/pet';
import { WeightTrendChart } from '../pets/WeightTrendChart';
import { ScreenContainer, AvatarPicker, Button, ErrorText } from '../components/ui';
import { shell, text, spacing, colors } from '../theme/theme';
import { PET_COLORS, petColor, onPetColorInk } from '../theme/petColors';
import { SPECIES_EMOJI, speciesDisplay } from '../pets/species';

interface SectionTile {
  key: string;
  label: string;
  emoji: string;
  color: string;
  count: (data: HubData) => string;
}

interface HubData {
  vaccines: Vaccine[];
  medications: Medication[];
  vetVisits: VetVisit[];
  weightLogs: WeightLog[];
  expenses: Expense[];
  documents: Document[];
}

function recordsLabel(n: number): string {
  return `${n} record${n === 1 ? '' : 's'}`;
}

const SECTIONS: SectionTile[] = [
  { key: 'VaccineList', label: 'Vaccines', emoji: '💉', color: '#EF4444', count: (d) => recordsLabel(d.vaccines.length) },
  { key: 'MedicationList', label: 'Medications', emoji: '💊', color: '#3B82F6', count: (d) => recordsLabel(d.medications.length) },
  { key: 'VetVisitList', label: 'Vet visits', emoji: '🩺', color: '#14B8A6', count: (d) => recordsLabel(d.vetVisits.length) },
  { key: 'WeightLog', label: 'Weight', emoji: '⚖️', color: '#84CC16', count: (d) => recordsLabel(d.weightLogs.length) },
  { key: 'ExpenseList', label: 'Expenses', emoji: '💰', color: '#F97316', count: (d) => recordsLabel(d.expenses.length) },
  { key: 'DocumentList', label: 'Documents', emoji: '📄', color: '#06B6D4', count: (d) => recordsLabel(d.documents.length) },
];

const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  food: 'Food', vet: 'Vet', grooming: 'Grooming', insurance: 'Insurance', supplies: 'Supplies', other: 'Other',
};

function formatEuros(cents: number): string {
  const value = cents / 100;
  return Number.isInteger(value) ? `€${value}` : `€${value.toFixed(2)}`;
}

function TagChip({ label, ink }: { label: string; ink: string }) {
  return (
    <View style={{ borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.24)', paddingVertical: 5, paddingHorizontal: 11 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: ink }}>{label}</Text>
    </View>
  );
}

export function PetHomeScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const { setSelectedPetId } = usePetSelection();
  const insets = useSafeAreaInsets();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [vetVisits, setVetVisits] = useState<VetVisit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [vets, setVets] = useState<Vet[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [statusSaving, setStatusSaving] = useState(false);
  const [generatingPassport, setGeneratingPassport] = useState(false);
  const [passportError, setPassportError] = useState<string | null>(null);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    const unsubs = [
      subscribeToWeightLogs(firestore, household.id, petId, setWeightLogs),
      subscribeToVaccines(firestore, household.id, petId, setVaccines),
      subscribeToMedications(firestore, household.id, petId, setMedications),
      subscribeToVetVisits(firestore, household.id, petId, setVetVisits),
      subscribeToExpenses(firestore, household.id, petId, setExpenses),
      subscribeToDocuments(firestore, household.id, petId, setDocuments),
    ];
    return () => unsubs.forEach((u) => u());
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVets(firestore, household.id, setVets);
  }, [household]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  if (!pet || !household) {
    return (
      <ScreenContainer style={{ flex: 1 }} background={shell.bg}>
        <Text style={{ color: text.secondary }}>Loading…</Text>
      </ScreenContainer>
    );
  }

  const color = petColor(pet);
  const ink = onPetColorInk(color);
  const hubData: HubData = { vaccines, medications, vetVisits, weightLogs, expenses, documents };
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const yearExpenses = expenses.filter((e) => e.date >= yearStart);
  const totalCents = yearExpenses.reduce((sum, e) => sum + e.amountCents, 0);
  const byCategory = (Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[])
    .map((cat) => ({ cat, cents: yearExpenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amountCents, 0) }))
    .filter((c) => c.cents > 0);

  const age = pet.birthDate != null ? Math.floor((Date.now() - pet.birthDate) / (365.25 * 24 * 60 * 60 * 1000)) : null;
  const neuteredLabel = pet.neutered === true ? 'Neutered' : pet.neutered === false ? 'Not neutered' : 'Neutering not set';
  const isRemembered = pet.status === 'remembered';

  const toggleRemembered = async () => {
    setStatusSaving(true);
    try {
      await updatePet(firestore, household.id, petId, { status: isRemembered ? 'active' : 'remembered' });
    } finally {
      setStatusSaving(false);
    }
  };

  const openCalendarForThisPet = () => {
    setSelectedPetId(petId);
    navigation.navigate('CalendarTab');
  };

  const handleGeneratePassport = async () => {
    if (!household || !canGeneratePassport(household)) {
      setPassportError(passportLimitMessage());
      return;
    }
    setGeneratingPassport(true);
    setPassportError(null);
    try {
      await generatePassport(pet, vaccines, vets);
    } catch (e: any) {
      setPassportError(e.message);
    } finally {
      setGeneratingPassport(false);
    }
  };

  return (
    <ScreenContainer scroll background={shell.bg} style={{ padding: 0, gap: spacing.md }}>
      <View style={{ backgroundColor: color, paddingTop: 16 + insets.top, paddingHorizontal: 18, paddingBottom: 22, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden' }}>
        <Text style={{ position: 'absolute', right: -16, bottom: -34, fontSize: 150, opacity: 0.2 }}>
          {SPECIES_EMOJI[pet.species] ?? '🐾'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 18, color: text.primary }}>←</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Pressable
              onPress={() => navigation.navigate('EditPet', { petId })}
              accessibilityRole="button"
              accessibilityLabel="Edit"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 8, paddingHorizontal: 14 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: text.primary }}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={toggleRemembered}
              disabled={statusSaving}
              accessibilityRole="button"
              accessibilityLabel={isRemembered ? 'Bring back' : 'Mark remembered'}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 8, paddingHorizontal: 14 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: text.primary }}>{isRemembered ? 'Bring back' : 'Mark remembered'}</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: spacing.xs, marginTop: spacing.md }}>
          <AvatarPicker
            photoUri={pet.photoUrl}
            onPicked={(uri) => updatePetPhoto(firestore, household.id, petId, uri)}
            size={82}
            emojiSize={40}
            fallbackEmoji={SPECIES_EMOJI[pet.species] ?? '🐾'}
            backgroundColor="rgba(255,255,255,0.30)"
            borderWidth={0}
            caption="none"
          />
          <Text style={{ fontSize: 30, fontWeight: '800', color: ink }}>{pet.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' }}>
            <TagChip label={`${speciesDisplay(pet)}${age != null ? ` · ${age} yr` : ''}`} ink={ink} />
            <TagChip label={pet.breed || 'No breed set'} ink={ink} />
            <TagChip label={neuteredLabel} ink={ink} />
            <TagChip label={pet.livingEnvironment ? pet.livingEnvironment.charAt(0).toUpperCase() + pet.livingEnvironment.slice(1) : 'Environment not set'} ink={ink} />
          </View>
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: text.onColourMuted, textAlign: 'center' }}>
            Identity colour
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
            {PET_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => updatePetColor(firestore, household.id, petId, c)}
                accessibilityRole="button"
                accessibilityLabel={`Set colour to ${c}`}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: '#FFFFFF' }}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {SECTIONS.map((s) => (
            <Pressable key={s.key} onPress={() => navigation.navigate(s.key, { petId })} style={{ width: '47%' }}>
              <View style={{ borderRadius: 20, backgroundColor: shell.card, padding: 14, minHeight: 100, justifyContent: 'flex-start', gap: spacing.xs }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: s.color + '40', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 19 }}>{s.emoji}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{s.label}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>{s.count(hubData)}</Text>
              </View>
            </Pressable>
          ))}
          <Pressable onPress={openCalendarForThisPet} style={{ width: '47%' }}>
            <View style={{ borderRadius: 20, backgroundColor: shell.card, padding: 14, minHeight: 100, justifyContent: 'flex-start', gap: spacing.xs }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: '#EC489940', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 19 }}>📅</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>Calendar</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>View this pet's calendar</Text>
            </View>
          </Pressable>
        </View>

        <View>
          <Button title="Generate Passport" onPress={handleGeneratePassport} loading={generatingPassport} />
          {passportError && <ErrorText>{passportError}</ErrorText>}
        </View>

        <View style={{ borderRadius: 22, backgroundColor: shell.card, padding: 16, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: text.primary }}>Weight trend</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color }}>
              {weightLogs.length > 0 ? `${[...weightLogs].sort((a, b) => b.date - a.date)[0].weight} kg` : 'No entries yet'}
            </Text>
          </View>
          <WeightTrendChart logs={weightLogs} color={color} />
        </View>

        <View style={{ borderRadius: 22, backgroundColor: shell.card, padding: 16, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: text.primary }}>Spend this year</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>{formatEuros(totalCents)}</Text>
          </View>
          {byCategory.length === 0 ? (
            <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>No expenses logged this year.</Text>
          ) : (
            byCategory.map(({ cat, cents }) => (
              <View key={cat} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: text.primary }}>{EXPENSE_CATEGORY_LABEL[cat]}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>{formatEuros(cents)}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                  <View style={{ height: 8, borderRadius: 4, width: `${Math.min(100, (cents / totalCents) * 100)}%`, backgroundColor: color }} />
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
