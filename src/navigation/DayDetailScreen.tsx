import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { useUpcomingReminders } from '../reminders/useUpcomingReminders';
import { markDone, skip } from '../reminders/reminderActions';
import { getSnoozes, isSnoozed } from '../reminders/snoozeStore';
import { useCalendarEvents } from '../calendar/useCalendarEvents';
import { updateEvent } from '../calendar/eventService';
import { mergeCalendarEntries, entriesForPet, entriesForDay, CalendarEntry } from '../calendar/calendarEntries';
import { EntryCard } from '../calendar/EntryCard';
import { usePetSelection } from '../selection/PetSelectionContext';
import { Pet } from '../types/pet';
import { ScreenContainer, Title, MutedText, GuidedEmptyState, ErrorText } from '../components/ui';
import { spacing } from '../theme/theme';

export function DayDetailScreen({ route, navigation }: any) {
  const { date } = route.params;
  const { user } = useAuth();
  const { household } = useHousehold();
  const { selectedPetId } = usePetSelection();
  const [pets, setPets] = useState<Pet[]>([]);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

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

  const handleDone = async (entry: CalendarEntry) => {
    if (!household || !user || !entry.reminder) return;
    setError(null);
    try {
      await markDone(firestore, household.id, entry.reminder, user.uid);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSkip = async (entry: CalendarEntry) => {
    if (!household || !user) return;
    setError(null);
    try {
      if (entry.reminder) {
        await skip(firestore, household.id, entry.reminder, user.uid);
      } else if (entry.event) {
        await updateEvent(firestore, household.id, entry.event.id, { status: 'skipped' });
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleToggleComplete = async (entry: CalendarEntry) => {
    if (!household || !entry.event) return;
    setError(null);
    try {
      await updateEvent(firestore, household.id, entry.event.id, { status: entry.completed ? 'upcoming' : 'completed' });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (entry: CalendarEntry) => {
    if (!entry.event) return;
    navigation.navigate('EditEvent', { eventId: entry.event.id });
  };

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Title>{new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Title>
      {error && <ErrorText>{error}</ErrorText>}
      <FlatList
        style={{ flex: 1 }}
        data={dayEntries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            <MutedText style={{ width: 64, paddingTop: spacing.sm }}>
              {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </MutedText>
            <View style={{ flex: 1 }}>
              <EntryCard
                entry={item}
                pets={pets}
                onDone={item.source === 'reminder' ? () => handleDone(item) : undefined}
                onSkip={() => handleSkip(item)}
                onToggleComplete={item.source === 'event' ? () => handleToggleComplete(item) : undefined}
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
