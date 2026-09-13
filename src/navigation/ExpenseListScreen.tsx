import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToExpenses } from '../pets/expenseService';
import { firestore } from '../firebase/config';
import { Expense, ExpenseCategory } from '../types/expense';
import { ScreenContainer, Card, Button, Chip, Subtitle, MutedText } from '../components/ui';
import { spacing } from '../theme/theme';

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
    <ScreenContainer style={{ flex: 1 }}>
      <Button title="Add expense" onPress={() => navigation.navigate('AddExpense', { petId })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={c === filter} onPress={() => setFilter(c)} />
        ))}
      </View>
      <Subtitle>Total: ${(totalCents / 100).toFixed(2)}</Subtitle>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Subtitle style={{ textTransform: 'capitalize' }}>{item.category}</Subtitle>
              <MutedText>{item.note}</MutedText>
            </View>
            <Subtitle>${(item.amountCents / 100).toFixed(2)}</Subtitle>
          </Card>
        )}
        ListEmptyComponent={<MutedText>No expenses yet.</MutedText>}
      />
    </ScreenContainer>
  );
}
