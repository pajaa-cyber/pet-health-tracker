import React, { useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { createMedication } from '../pets/medicationService';
import { firestore } from '../firebase/config';
import { DateField } from '../components/DateField';
import { ScreenContainer, TextField, Button, ErrorText } from '../components/ui';

export function AddMedicationScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [timesPerDay, setTimesPerDay] = useState('1');
  const [intervalDays, setIntervalDays] = useState('1');
  const [startDate, setStartDate] = useState(Date.now());
  const [endDate, setEndDate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    setLoading(true);
    try {
      await createMedication(
        firestore, household.id, petId, name, dosage,
        { timesPerDay: parseInt(timesPerDay, 10) || 1, intervalDays: parseInt(intervalDays, 10) || 1 },
        startDate, endDate
      );
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <TextField label="Medication name" value={name} onChangeText={setName} />
      <TextField label="Dosage" placeholder="e.g. 250mg" value={dosage} onChangeText={setDosage} />
      <TextField
        label="Times per day"
        value={timesPerDay}
        onChangeText={setTimesPerDay}
        keyboardType="number-pad"
      />
      <TextField
        label="Every N days"
        value={intervalDays}
        onChangeText={setIntervalDays}
        keyboardType="number-pad"
      />
      <DateField label="Start date" value={startDate} onChange={setStartDate} />
      <DateField label="End date" value={endDate} onChange={setEndDate} onClear={() => setEndDate(null)} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Add medication" onPress={handleSubmit} loading={loading} />
    </ScreenContainer>
  );
}
