import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Text, Button } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToExpenses } from '../pets/expenseService';
import { firestore } from '../firebase/config';
import { Expense, ExpenseCategory } from '../types/expense';

const CATEGORIES: (ExpenseCategory | 'all')[] = ['all', 'food', 'vet', 'grooming', 'insurance', 'supplies', 'other'];

export function ExpenseListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState<ExpenseCategory | 'all'>('all');

  useEffect(() => {
    if (!household) return;
    return subscribeToExpenses(firestore, household.id, petId, setExpenses);
  }, [household, petId]);

  const filtered = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.category === filter)),
    [expenses, filter]
  );
  const totalCents = useMemo(() => filtered.reduce((sum, e) => sum + e.amountCents, 0), [filtered]);

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title="Add expense" onPress={() => navigation.navigate('AddExpense', { petId })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {CATEGORIES.map((c) => (
          <Button key={c} title={c} onPress={() => setFilter(c)} />
        ))}
      </View>
      <Text>Total: ${(totalCents / 100).toFixed(2)}</Text>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Text>
            {item.category}: ${(item.amountCents / 100).toFixed(2)} — {item.note}
          </Text>
        )}
        ListEmptyComponent={<Text>No expenses yet.</Text>}
      />
    </View>
  );
}
