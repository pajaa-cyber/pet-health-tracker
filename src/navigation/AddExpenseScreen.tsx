import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createExpense } from '../pets/expenseService';
import { firestore } from '../firebase/config';
import { ExpenseCategory } from '../types/expense';

const CATEGORIES: ExpenseCategory[] = ['food', 'vet', 'grooming', 'insurance', 'supplies', 'other'];

export function AddExpenseScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) {
      setError('Enter a valid amount');
      return;
    }
    try {
      await createExpense(firestore, household.id, petId, Date.now(), category, Math.round(parsed * 100), note);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {CATEGORIES.map((c) => (
          <Button key={c} title={c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <Text>Selected category: {category}</Text>
      <TextInput placeholder="Note" value={note} onChangeText={setNote} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add expense" onPress={handleSubmit} />
    </View>
  );
}
