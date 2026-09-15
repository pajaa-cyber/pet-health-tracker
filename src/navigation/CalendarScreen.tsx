import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { useUpcomingReminders } from '../reminders/useUpcomingReminders';
import { useNotificationPermission } from '../reminders/useNotificationPermission';
import { markDone, skip, snooze } from '../reminders/reminderActions';
import { getSnoozes, isSnoozed } from '../reminders/snoozeStore';
import { useCalendarEvents } from '../calendar/useCalendarEvents';
import { updateEvent } from '../calendar/eventService';
import {
  mergeCalendarEntries, entriesForDay, entriesForPet, overdueEntries,
  startOfWeek, startOfMonth, CalendarEntry,
} from '../calendar/calendarEntries';
import { startOfDay } from '../reminders/computeUpcoming';
import { EntryCard } from '../calendar/EntryCard';
import { WeekView } from '../calendar/WeekView';
import { MonthView } from '../calendar/MonthView';
import { usePetSelection } from '../selection/PetSelectionContext';
import { Pet } from '../types/pet';
import {
  ScreenContainer, Card, Button, Chip, Title, Subtitle, MutedText, PermissionBar, PetSelector, GuidedEmptyState,
} from '../components/ui';
import { colors, spacing } from '../theme/theme';

const DAY_MS = 24 * 60 * 60 * 1000;
type ViewMode = 'week' | 'month' | 'overdue';

export function CalendarScreen({ navigation }: any) {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { granted, request } = useNotificationPermission();
  const { selectedPetId } = usePetSelection();
  const [pets, setPets] = useState<Pet[]>([]);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(startOfDay(Date.now()));

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

  // Snoozes are keyed by the *original* UpcomingReminder.id (e.g.
  // "vaccine:vax-1"), exactly as Plan 5's snoozeReminder() stores them —
  // not by CalendarEntry.id, which has its own "reminder:"/"event:" prefix
  // (Task 2). Comparing snoozes against entry.id instead of
  // entry.reminder.id would silently never match, and a snoozed reminder
  // would incorrectly reappear here — this is exactly the kind of thing
  // Plan 5's own device verification caught once already; don't reintroduce
  // it. Events have no snooze concept in this plan, so they always pass.
  const allEntries = mergeCalendarEntries(reminders, events, now)
    .filter((e) => e.reminder == null || !isSnoozed(snoozes, e.reminder.id, now));
  const petFilteredEntries = entriesForPet(allEntries, selectedPetId);

  const refreshSnoozes = () => getSnoozes().then(setSnoozes);

  const handleDone = async (entry: CalendarEntry) => {
    if (!household || !user || !entry.reminder) return;
    await markDone(firestore, household.id, entry.reminder, user.uid);
  };

  const handleSkip = async (entry: CalendarEntry) => {
    if (!household || !user) return;
    if (entry.reminder) {
      await skip(firestore, household.id, entry.reminder, user.uid);
    } else if (entry.event) {
      await updateEvent(firestore, household.id, entry.event.id, { status: 'skipped' });
    }
  };

  const handleSnooze = async (entry: CalendarEntry) => {
    if (!entry.reminder) return;
    await snooze(entry.reminder, 3);
    refreshSnoozes();
  };

  const handleToggleComplete = async (entry: CalendarEntry) => {
    if (!household || !entry.event) return;
    await updateEvent(firestore, household.id, entry.event.id, { status: entry.completed ? 'upcoming' : 'completed' });
  };

  const handleEdit = (entry: CalendarEntry) => {
    if (!entry.event) return;
    navigation.navigate('EditEvent', { eventId: entry.event.id });
  };

  const renderEntry = ({ item }: { item: CalendarEntry }) => (
    <EntryCard
      entry={item}
      pets={pets}
      onDone={item.source === 'reminder' ? () => handleDone(item) : undefined}
      onSkip={() => handleSkip(item)}
      onSnooze={item.source === 'reminder' ? () => handleSnooze(item) : undefined}
      onToggleComplete={item.source === 'event' ? () => handleToggleComplete(item) : undefined}
      onEdit={item.source === 'event' ? () => handleEdit(item) : undefined}
    />
  );

  const overdueList = overdueEntries(petFilteredEntries);
  const dayList = entriesForDay(petFilteredEntries, selectedDate);
  const listData = viewMode === 'overdue' ? overdueList : dayList;

  return (
    <ScreenContainer style={{ flex: 1 }}>
      {granted === false && (
        <PermissionBar message="Reminders need notifications. Tap to enable." onPress={request} />
      )}
      <Title>Calendar</Title>
      <PetSelector pets={pets} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label="Week" selected={viewMode === 'week'} onPress={() => setViewMode('week')} />
        <Chip label="Month" selected={viewMode === 'month'} onPress={() => setViewMode('month')} />
        <Chip label={`Overdue (${overdueList.length})`} selected={viewMode === 'overdue'} onPress={() => setViewMode('overdue')} />
      </View>
      <Button
        title="Reminder settings"
        variant="outline"
        onPress={() => navigation.navigate('ReminderSettings')}
      />
      {viewMode === 'week' && (
        <Card>
          <WeekView
            weekStart={startOfWeek(selectedDate)}
            selectedDate={selectedDate}
            entries={petFilteredEntries}
            onSelectDate={setSelectedDate}
          />
        </Card>
      )}
      {viewMode === 'month' && (
        <Card>
          <MonthView
            monthStart={startOfMonth(selectedDate)}
            selectedDate={selectedDate}
            entries={petFilteredEntries}
            onSelectDate={setSelectedDate}
          />
        </Card>
      )}
      {viewMode !== 'overdue' && (
        <Subtitle>{new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Subtitle>
      )}
      <FlatList
        data={listData}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}
        renderItem={renderEntry}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji={viewMode === 'overdue' ? '✅' : '🗓️'}
            title={viewMode === 'overdue' ? 'Nothing overdue' : 'Nothing here'}
            message={
              viewMode === 'overdue'
                ? 'Every reminder and event is on track.'
                : 'Vaccines, doses, follow-ups, and anything you log will show up here on the day they fall.'
            }
            actionLabel="Reminder settings"
            onAction={() => navigation.navigate('ReminderSettings')}
          />
        }
      />
    </ScreenContainer>
  );
}
