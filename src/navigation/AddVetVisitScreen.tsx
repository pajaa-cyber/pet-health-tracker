import React, { useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { createVetVisit } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';
import { DateField } from '../components/DateField';
import { ScreenContainer, TextField, Button, ErrorText, MutedText } from '../components/ui';

export function AddVetVisitScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(Date.now());
  const [followUpDate, setFollowUpDate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    setLoading(true);
    try {
      await createVetVisit(firestore, household.id, petId, date, reason, notes, followUpDate);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <TextField label="Reason for visit" value={reason} onChangeText={setReason} />
      <TextField label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 96, textAlignVertical: 'top' }} />
      <DateField label="Visit date" value={date} onChange={setDate} />
      <DateField label="Follow-up date" value={followUpDate} onChange={setFollowUpDate} onClear={() => setFollowUpDate(null)} />
      <MutedText>Optional — leave unset if the vet didn't ask you to come back.</MutedText>
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Add vet visit" onPress={handleSubmit} loading={loading} />
    </ScreenContainer>
  );
}
