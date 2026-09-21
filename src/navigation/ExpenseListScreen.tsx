import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToExpenses } from '../pets/expenseService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Expense, ExpenseCategory } from '../types/expense';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton, Chip } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

const CATEGORIES: (ExpenseCategory | 'all')[] = ['all', 'food', 'vet', 'grooming', 'insurance', 'supplies', 'other'];

export function ExpenseListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [filter, setFilter] = useState<ExpenseCategory | 'all'>('all');
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToExpenses(firestore, household.id, petId, setExpenses);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const filtered = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.category === filter)),
    [expenses, filter]
  );
  const totalCents = useMemo(() => filtered.reduce((sum, e) => sum + e.amountCents, 0), [filtered]);
  const rail = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Expenses"
        subtitle={`${pet?.name ?? 'Pet'} · ${expenses.length} ${expenses.length === 1 ? 'entry' : 'entries'}`}
        onBack={() => navigation.goBack()}
      />
      <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={c === filter}
              onPress={() => setFilter(c)}
              selectedBg="#FFFFFF"
              selectedColor={shell.bg}
              unselectedBg="rgba(255,255,255,0.10)"
              unselectedColor="rgba(255,255,255,0.8)"
            />
          ))}
        </View>
        <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>
          Total: ${(totalCents / 100).toFixed(2)}
        </Text>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
            <View style={{ width: 6, backgroundColor: rail }} />
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary, textTransform: 'capitalize' }}>
                  {item.category}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>{item.note}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: text.primary }}>
                ${(item.amountCents / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: text.secondary, fontSize: 14, textAlign: 'center', paddingTop: spacing.xl }}>
            No expenses yet.
          </Text>
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add an expense" onPress={() => navigation.navigate('AddExpense', { petId })} />
      </View>
    </ScreenContainer>
  );
}
