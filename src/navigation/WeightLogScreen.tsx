import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToWeightLogs, createWeightLog, deleteWeightLog } from '../pets/weightLogService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { WeightLog } from '../types/weightLog';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { WeightTrendChart } from '../pets/WeightTrendChart';
import { DateField } from '../components/DateField';
import { ScreenContainer, RecordListHeader, TextField, Button, Chip, ErrorText, MutedText, GuidedEmptyState } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';
import { displayToKg, unitLabel, WeightUnit } from '../pets/units';
import { computeWeightTrend } from '../pets/weightTrend';

type WeighingMethod = 'justPet' | 'humanAndPet';

export function WeightLogScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [method, setMethod] = useState<WeighingMethod>('justPet');
  const [weight, setWeight] = useState('');
  const [combinedWeight, setCombinedWeight] = useState('');
  const [ownerWeight, setOwnerWeight] = useState('');
  const [date, setDate] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pet = pets.find((p) => p.id === petId);
  const unit: WeightUnit = household?.weightUnit ?? 'kg';

  useEffect(() => {
    if (!household) return;
    return subscribeToWeightLogs(firestore, household.id, petId, setLogs);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const petWeightInUnit =
    method === 'humanAndPet'
      ? (parseFloat(combinedWeight) || 0) - (parseFloat(ownerWeight) || 0)
      : parseFloat(weight);

  const handleAdd = async () => {
    if (!household) return;
    setError(null);
    if (isNaN(petWeightInUnit) || petWeightInUnit <= 0) {
      setError('Enter a valid weight');
      return;
    }
    setLoading(true);
    try {
      await createWeightLog(firestore, household.id, petId, date, displayToKg(petWeightInUnit, unit));
      setWeight('');
      setCombinedWeight('');
      setOwnerWeight('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (log: WeightLog) => {
    if (!household) return;
    Alert.alert('Delete this weight entry?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteWeightLog(firestore, household.id, petId, log.id) },
    ]);
  };

  const color = pet ? petColor(pet) : shell.control;
  const weightTrend = computeWeightTrend(logs);

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
            variant="dark"
          />
        ) : (
          <View style={{ borderRadius: 22, backgroundColor: shell.card, padding: 16, gap: spacing.sm }}>
            {weightTrend && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13 }}>{weightTrend.direction === 'up' ? '📈' : weightTrend.direction === 'down' ? '📉' : '➖'}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: text.secondary }}>
                  {weightTrend.direction === 'flat'
                    ? 'No change since last weigh-in'
                    : `${weightTrend.percent > 0 ? '+' : ''}${weightTrend.percent.toFixed(1)}% since last weigh-in`}
                </Text>
              </View>
            )}
            <WeightTrendChart
              logs={logs}
              color={color}
              labelColor={text.secondary}
              valueLabelColor={text.primary}
              selectedBarColor={color}
              unit={unit}
              onDelete={handleDelete}
            />
          </View>
        )}

        <View style={{ gap: spacing.xs }}>
          <MutedText>Weighing method</MutedText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label="Just pet" selected={method === 'justPet'} onPress={() => setMethod('justPet')} />
            <Chip label="Owner + pet" selected={method === 'humanAndPet'} onPress={() => setMethod('humanAndPet')} />
          </View>
        </View>

        {method === 'justPet' ? (
          <TextField
            label={`Weight (${unitLabel(unit)})`}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
        ) : (
          <>
            <TextField
              label={`Owner + pet weight (${unitLabel(unit)})`}
              value={combinedWeight}
              onChangeText={setCombinedWeight}
              keyboardType="decimal-pad"
            />
            <TextField
              label={`Owner weight alone (${unitLabel(unit)})`}
              value={ownerWeight}
              onChangeText={setOwnerWeight}
              keyboardType="decimal-pad"
            />
            <MutedText>
              Pet weight: {petWeightInUnit > 0 ? petWeightInUnit.toFixed(1) : '—'} {unitLabel(unit)}
            </MutedText>
          </>
        )}

        <DateField label="Date" value={date} onChange={setDate} />
        {error && <ErrorText>{error}</ErrorText>}
        <Button title="Log weight" onPress={handleAdd} loading={loading} variant="accent" />
      </View>
    </ScreenContainer>
  );
}
