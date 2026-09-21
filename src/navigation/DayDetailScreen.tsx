import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { useUpcomingReminders } from '../reminders/useUpcomingReminders';
import { getSnoozes, isSnoozed } from '../reminders/snoozeStore';
import { useCalendarEvents } from '../calendar/useCalendarEvents';
import { mergeCalendarEntries, entriesForPet, entriesForDay } from '../calendar/calendarEntries';
import { useCalendarEntryActions } from '../calendar/useCalendarEntryActions';
import { EntryCard } from '../calendar/EntryCard';
import { usePetSelection } from '../selection/PetSelectionContext';
import { Pet } from '../types/pet';
import { ScreenContainer, GuidedEmptyState, ErrorText } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function DayDetailScreen({ route, navigation }: any) {
  const { date } = route.params;
  const { user } = useAuth();
  const { household } = useHousehold();
  const { selectedPetId } = usePetSelection();
  const insets = useSafeAreaInsets();
  const [pets, setPets] = useState<Pet[]>([]);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const { handleDone, handleSkip, handleEdit, error } = useCalendarEntryActions(household, user?.uid ?? null, navigation);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    getSnoozes().then(setSnoozes);
  }, []);

  const reminders = useUpcomingReminders(pets);
  const events = useCalendarEvents();
  const now = Date.now();

  const allEntries = mergeCalendarEntries(reminders, events, now)
    .filter((e) => e.reminder == null || !isSnoozed(snoozes, e.reminder.id, now));
  const petFilteredEntries = entriesForPet(allEntries, selectedPetId);
  const dayEntries = entriesForDay(petFilteredEntries, date).slice().sort((a, b) => a.date - b.date);

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm }}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: shell.control, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 18, color: text.primary }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '800', color: text.primary }}>
          {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>
      {error && (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
          <ErrorText>{error}</ErrorText>
        </View>
      )}
      <FlatList
        style={{ flex: 1 }}
        data={dayEntries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <Text style={{ width: 56, paddingTop: 16, fontSize: 12, fontWeight: '600', color: text.secondary }}>
              {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View style={{ flex: 1 }}>
              <EntryCard
                entry={item}
                pets={pets}
                onDone={() => handleDone(item)}
                onSkip={() => handleSkip(item)}
                onEdit={item.source === 'event' ? () => handleEdit(item) : undefined}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="🗓️"
            title="Nothing this day"
            message="Vaccines, doses, follow-ups, and anything you log will show up here."
            actionLabel="Add to Calendar"
            onAction={() => navigation.navigate('AddEvent')}
          />
        }
      />
    </ScreenContainer>
  );
}
