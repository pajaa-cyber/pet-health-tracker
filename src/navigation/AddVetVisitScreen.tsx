import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createVetVisit } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';

export function AddVetVisitScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    try {
      await createVetVisit(firestore, household.id, petId, Date.now(), reason, notes);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="Reason for visit" value={reason} onChangeText={setReason} />
      <TextInput placeholder="Notes" value={notes} onChangeText={setNotes} multiline />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add vet visit" onPress={handleSubmit} />
    </View>
  );
}
