import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs, createWeightLog } from '../pets/weightLogService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { WeightTrendChart } from '../pets/WeightTrendChart';
import { DateField } from '../components/DateField';
import { ScreenContainer, RecordListHeader, TextField, Button, ErrorText, GuidedEmptyState } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function WeightLogScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToWeightLogs(firestore, household.id, petId, setLogs);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

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

  const color = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer scroll background={shell.bg} style={{ padding: 0 }}>
      <RecordListHeader
        title="Weight"
        subtitle={`${pet?.name ?? 'Pet'} · ${logs.length} ${logs.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        {logs.length === 0 ? (
          <GuidedEmptyState
            emoji="⚖️"
            title="No weight logged yet"
            message="Track your pet's weight to spot health changes early."
            actionLabel="Log weight"
            onAction={() => {}}
          />
        ) : (
          <View style={{ borderRadius: 22, backgroundColor: shell.card, padding: 16 }}>
            <WeightTrendChart
              logs={logs}
              color={color}
              labelColor={text.secondary}
              valueLabelColor={text.primary}
              selectedBarColor={color}
            />
          </View>
        )}
        <TextField label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <DateField label="Date" value={date} onChange={setDate} />
        {error && <ErrorText>{error}</ErrorText>}
        <Button title="Log weight" onPress={handleAdd} loading={loading} variant="accent" />
      </View>
    </ScreenContainer>
  );
}
