import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets } from '../pets/petService';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { subscribeToMedications } from '../pets/medicationService';
import { subscribeToWeightLogs } from '../pets/weightLogService';
import { subscribeToVets } from '../vets/vetService';
import { generateVetPrepReport } from '../documents/vetPrepService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { VetVisit } from '../types/vetVisit';
import { Medication } from '../types/medication';
import { WeightLog } from '../types/weightLog';
import { Vet } from '../types/vet';
import { DateField } from '../components/DateField';
import { ScreenContainer, TextField, Button, Title, MutedText, ErrorText } from '../components/ui';
import { spacing } from '../theme/theme';

export function PrepareForVetScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [vetVisits, setVetVisits] = useState<VetVisit[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [vets, setVets] = useState<Vet[]>([]);
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [startedDate, setStartedDate] = useState<number | null>(null);
  const [recentChanges, setRecentChanges] = useState('');
  const [questionsText, setQuestionsText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    const unsubs = [
      subscribeToPets(firestore, household.id, setPets),
      subscribeToVaccines(firestore, household.id, petId, setVaccines),
      subscribeToVetVisits(firestore, household.id, petId, setVetVisits),
      subscribeToMedications(firestore, household.id, petId, setMedications),
      subscribeToWeightLogs(firestore, household.id, petId, setWeightLogs),
      subscribeToVets(firestore, household.id, setVets),
    ];
    return () => unsubs.forEach((u) => u());
  }, [household, petId]);

  const handleGenerate = async () => {
    if (!household || !pet) return;
    setError(null);
    setGenerating(true);
    try {
      const questions = questionsText.split('\n').map((q) => q.trim()).filter(Boolean);
      await generateVetPrepReport(
        pet,
        { reasonForVisit: reasonForVisit.trim(), startedDate, recentChanges: recentChanges.trim(), questions },
        vaccines, vets, vetVisits, medications, weightLogs,
        household.weightUnit ?? 'kg'
      );
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (!pet) {
    return (
      <ScreenContainer>
        <MutedText>Loading…</MutedText>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Title>Prepare for vet</Title>
      <MutedText>
        A quick note or two, and the report pulls in everything the app already knows about {pet.name} — medications,
        weight trend, vaccination status and recent visit history.
      </MutedText>
      <TextField
        label="Reason for visit"
        placeholder="e.g. Vomiting, lethargy…"
        value={reasonForVisit}
        onChangeText={setReasonForVisit}
      />
      <DateField label="Started (optional)" value={startedDate} onChange={setStartedDate} onClear={() => setStartedDate(null)} />
      <TextField
        label="Recent changes (optional)"
        placeholder="e.g. New food, new environment…"
        value={recentChanges}
        onChangeText={setRecentChanges}
        scrollToEnd
      />
      <TextField
        label="Questions for the vet (optional, one per line)"
        placeholder={'e.g.\nIs this serious?\nAny dietary changes needed?'}
        value={questionsText}
        onChangeText={setQuestionsText}
        multiline
        style={{ minHeight: 96, textAlignVertical: 'top' }}
        scrollToEnd
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Generate report" onPress={handleGenerate} loading={generating} />
      {/* Same fix as AddBloodTestScreen: this form's content sits right at
          one screen's height without a keyboard open, which left the
          ScrollView unable to reliably become scrollable once the keyboard
          covered the lower fields — found live on-device. A fixed spacer
          guarantees content is always taller than any visible area. */}
      <View style={{ height: 280 }} />
    </ScreenContainer>
  );
}
