import React, { useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { createVaccine } from '../pets/vaccineService';
import { firestore } from '../firebase/config';
import { DateField } from '../components/DateField';
import { ScreenContainer, TextField, Button, ErrorText } from '../components/ui';

export function AddVaccineScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [name, setName] = useState('');
  const [vetName, setVetName] = useState('');
  const [dateGiven, setDateGiven] = useState(Date.now());
  const [nextDueDate, setNextDueDate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    setLoading(true);
    try {
      await createVaccine(firestore, household.id, petId, name, dateGiven, nextDueDate, vetName);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <TextField label="Vaccine name" placeholder="e.g. Rabies" value={name} onChangeText={setName} />
      <TextField label="Vet name" placeholder="Optional" value={vetName} onChangeText={setVetName} />
      <DateField label="Date given" value={dateGiven} onChange={setDateGiven} />
      <DateField
        label="Next due date"
        value={nextDueDate}
        onChange={setNextDueDate}
        onClear={() => setNextDueDate(null)}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Add vaccine" onPress={handleSubmit} loading={loading} />
    </ScreenContainer>
  );
}
