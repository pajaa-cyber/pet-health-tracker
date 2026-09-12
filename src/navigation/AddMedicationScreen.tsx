import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createMedication } from '../pets/medicationService';
import { firestore } from '../firebase/config';
import { DateField } from '../components/DateField';

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

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    try {
      await createMedication(
        firestore, household.id, petId, name, dosage,
        { timesPerDay: parseInt(timesPerDay, 10) || 1, intervalDays: parseInt(intervalDays, 10) || 1 },
        startDate, endDate
      );
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="Medication name" value={name} onChangeText={setName} />
      <TextInput placeholder="Dosage (e.g. 250mg)" value={dosage} onChangeText={setDosage} />
      <TextInput placeholder="Times per day" value={timesPerDay} onChangeText={setTimesPerDay} keyboardType="number-pad" />
      <TextInput placeholder="Every N days" value={intervalDays} onChangeText={setIntervalDays} keyboardType="number-pad" />
      <DateField label="Start date" value={startDate} onChange={setStartDate} />
      <DateField label="End date" value={endDate} onChange={setEndDate} onClear={() => setEndDate(null)} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add medication" onPress={handleSubmit} />
    </View>
  );
}
