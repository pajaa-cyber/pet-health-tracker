import React, { useState } from 'react';
import { View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createExpense } from '../pets/expenseService';
import { firestore } from '../firebase/config';
import { ExpenseCategory } from '../types/expense';
import { DateField } from '../components/DateField';
import { ScreenContainer, TextField, Button, ErrorText, Chip } from '../components/ui';
import { spacing } from '../theme/theme';

const CATEGORIES: ExpenseCategory[] = ['food', 'vet', 'grooming', 'insurance', 'supplies', 'other'];

export function AddExpenseScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount greater than $0');
      return;
    }
    setLoading(true);
    try {
      await createExpense(firestore, household.id, petId, date, category, Math.round(parsed * 100), note);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <TextField label="Amount ($)" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={c === category} onPress={() => setCategory(c)} />
        ))}
      </View>
      <TextField label="Note" placeholder="Optional" value={note} onChangeText={setNote} />
      <DateField label="Date" value={date} onChange={setDate} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Add expense" onPress={handleSubmit} loading={loading} />
    </ScreenContainer>
  );
}
