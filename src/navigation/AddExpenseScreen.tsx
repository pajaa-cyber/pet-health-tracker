import React, { useState } from 'react';
import { View, TextInput, Button, Text, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createExpense } from '../pets/expenseService';
import { firestore } from '../firebase/config';
import { ExpenseCategory } from '../types/expense';
import { DateField } from '../components/DateField';

const CATEGORIES: ExpenseCategory[] = ['food', 'vet', 'grooming', 'insurance', 'supplies', 'other'];

export function AddExpenseScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount greater than $0');
      return;
    }
    try {
      await createExpense(firestore, household.id, petId, date, category, Math.round(parsed * 100), note);
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
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 6,
              backgroundColor: c === category ? '#2563eb' : '#e5e7eb',
            }}
          >
            <Text style={{ color: c === category ? '#fff' : '#000' }}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput placeholder="Note" value={note} onChangeText={setNote} />
      <DateField label="Date" value={date} onChange={setDate} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Add expense" onPress={handleSubmit} />
    </View>
  );
}
