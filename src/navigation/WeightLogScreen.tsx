import React, { useEffect, useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs, createWeightLog } from '../pets/weightLogService';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { WeightTrendChart } from '../pets/WeightTrendChart';
import { DateField } from '../components/DateField';

export function WeightLogScreen({ route }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

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
    try {
      await createWeightLog(firestore, household.id, petId, date, parsed);
      setWeight('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <WeightTrendChart logs={logs} />
      <TextInput placeholder="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
      <DateField label="Date" value={date} onChange={setDate} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Log weight" onPress={handleAdd} />
    </View>
  );
}
