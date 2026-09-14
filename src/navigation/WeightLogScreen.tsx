import React, { useEffect, useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs, createWeightLog } from '../pets/weightLogService';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { WeightTrendChart } from '../pets/WeightTrendChart';
import { DateField } from '../components/DateField';
import { ScreenContainer, Card, TextField, Button, ErrorText, GuidedEmptyState } from '../components/ui';

export function WeightLogScreen({ route }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToWeightLogs(firestore, household.id, petId, setLogs);
  }, [household, petId]);

  const handleAdd = async () => {
    if (!household) return;
    setError(null);
    const parsed = parseFloat(weight);
    if (isNaN(parsed)) {
      setError('Enter a valid weight');
      return;
    }
    setLoading(true);
    try {
      await createWeightLog(firestore, household.id, petId, date, parsed);
      setWeight('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      {logs.length === 0 ? (
        <GuidedEmptyState
          emoji="⚖️"
          title="No weight logged yet"
          message="Track your pet's weight to spot health changes early."
          actionLabel="Log weight"
          onAction={handleAdd}
        />
      ) : (
        <Card>
          <WeightTrendChart logs={logs} />
        </Card>
      )}
      <TextField label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
      <DateField label="Date" value={date} onChange={setDate} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Log weight" onPress={handleAdd} loading={loading} />
    </ScreenContainer>
  );
}
