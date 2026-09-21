import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { useUpcomingReminders } from '../reminders/useUpcomingReminders';
import { useNotificationPermission } from '../reminders/useNotificationPermission';
import { getSnoozes, isSnoozed } from '../reminders/snoozeStore';
import { useCalendarEvents } from '../calendar/useCalendarEvents';
import {
  mergeCalendarEntries, entriesForDay, entriesForPet, overdueEntries,
  startOfWeek, startOfMonth, addDays, CalendarEntry,
} from '../calendar/calendarEntries';
import { startOfDay } from '../reminders/computeUpcoming';
import { useCalendarEntryActions } from '../calendar/useCalendarEntryActions';
import { EntryCard } from '../calendar/EntryCard';
import { WeekView } from '../calendar/WeekView';
import { MonthView } from '../calendar/MonthView';
import { usePetSelection } from '../selection/PetSelectionContext';
import { Pet } from '../types/pet';
import {
  ScreenContainer, Chip, PermissionBar, PetSelector, GuidedEmptyState, ErrorText,
} from '../components/ui';
import { shell, text, accentLavender, spacing } from '../theme/theme';

type ViewMode = 'week' | 'month' | 'overdue';

function shiftMonth(date: number, delta: number): number {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return startOfMonth(d.getTime());
}

export function CalendarScreen({ navigation }: any) {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { granted, request } = useNotificationPermission();
  const { selectedPetId } = usePetSelection();
  const insets = useSafeAreaInsets();
  const [pets, setPets] = useState<Pet[]>([]);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(startOfDay(Date.now()));
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

  const handlePrev = () => {
    setSelectedDate((prev) => (viewMode === 'month' ? shiftMonth(prev, -1) : addDays(prev, -7)));
  };

  const handleNext = () => {
    setSelectedDate((prev) => (viewMode === 'month' ? shiftMonth(prev, 1) : addDays(prev, 7)));
  };

  const handleToday = () => setSelectedDate(startOfDay(Date.now()));

  const renderEntry = ({ item }: { item: CalendarEntry }) => (
    <EntryCard
      entry={item}
      pets={pets}
      onDone={() => handleDone(item)}
      onSkip={() => handleSkip(item)}
      onEdit={item.source === 'event' ? () => handleEdit(item) : undefined}
    />
  );

  const overdueList = overdueEntries(petFilteredEntries);
  const dayList = entriesForDay(petFilteredEntries, selectedDate);
  const listData = viewMode === 'overdue' ? overdueList : dayList;

  const rangeLabel =
    viewMode === 'month'
      ? new Date(selectedDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : `${new Date(startOfWeek(selectedDate)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${new Date(addDays(startOfWeek(selectedDate), 6)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

  const agendaHeading = viewMode === 'overdue'
    ? 'Overdue'
    : new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const agendaCount = listData.length;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <FlatList
        style={{ flex: 1 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.md, gap: spacing.md, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: accentLavender }}>
                  Everything, one place
                </Text>
                <Text style={{ fontSize: 26, fontWeight: '800', color: text.primary }}>Calendar</Text>
              </View>
              <Chip
                label="⚙︎ Reminders"
                selected={false}
                onPress={() => navigation.navigate('ReminderSettings')}
                unselectedBg={shell.control}
                unselectedColor={text.primary}
              />
            </View>
            {granted === false && (
              <PermissionBar message="Reminders need notifications. Tap to enable." onPress={request} />
            )}
            {error && <ErrorText>{error}</ErrorText>}
            <PetSelector pets={pets} variant="dark" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Chip
                label="Week"
                selected={viewMode === 'week'}
                onPress={() => setViewMode('week')}
                selectedBg="#FFFFFF"
                selectedColor={shell.bg}
                unselectedBg="rgba(255,255,255,0.10)"
                unselectedColor="rgba(255,255,255,0.8)"
              />
              <Chip
                label="Month"
                selected={viewMode === 'month'}
                onPress={() => setViewMode('month')}
                selectedBg="#FFFFFF"
                selectedColor={shell.bg}
                unselectedBg="rgba(255,255,255,0.10)"
                unselectedColor="rgba(255,255,255,0.8)"
              />
              <Chip
                label={`Overdue (${overdueList.length})`}
                selected={viewMode === 'overdue'}
                onPress={() => setViewMode('overdue')}
                selectedBg="#FFFFFF"
                selectedColor={shell.bg}
                unselectedBg="rgba(255,255,255,0.10)"
                unselectedColor="rgba(255,255,255,0.8)"
              />
            </View>
            {viewMode !== 'overdue' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Pressable44 label="‹" onPress={handlePrev} />
                <Pressable
                  onPress={handleToday}
                  accessibilityRole="button"
                  style={{ flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: shell.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: text.primary }}>{rangeLabel} · Today</Text>
                </Pressable>
                <Pressable44 label="›" onPress={handleNext} />
              </View>
            )}
            {viewMode === 'week' && (
              <WeekView weekStart={startOfWeek(selectedDate)} selectedDate={selectedDate} entries={petFilteredEntries} pets={pets} onSelectDate={setSelectedDate} />
            )}
            {viewMode === 'month' && (
              <MonthView monthStart={startOfMonth(selectedDate)} selectedDate={selectedDate} entries={petFilteredEntries} pets={pets} onSelectDate={setSelectedDate} />
            )}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 17, fontWeight: '800', color: text.primary }}>{agendaHeading}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  {agendaCount} thing{agendaCount === 1 ? '' : 's'} {viewMode === 'overdue' ? 'waiting' : 'on this day'}
                </Text>
              </View>
              {viewMode !== 'overdue' && (
                <Pressable
                  onPress={() => navigation.navigate('DayDetail', { date: selectedDate })}
                  accessibilityRole="button"
                  accessibilityLabel="View full day"
                  hitSlop={8}
                  style={{ minHeight: 44, borderRadius: 14, backgroundColor: shell.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: text.primary }}>View full day</Text>
                </Pressable>
              )}
            </View>
          </View>
        }
        data={listData}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm }}
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
            variant="dark"
          />
        }
      />
    </ScreenContainer>
  );
}

function Pressable44({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: shell.control, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 18, fontWeight: '800', color: text.primary }}>{label}</Text>
    </Pressable>
  );
}
