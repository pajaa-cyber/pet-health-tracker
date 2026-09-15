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
import { Pet } from '../types/pet';
import { UpcomingReminder } from '../reminders/computeUpcoming';
import {
  ScreenContainer, Card, Button, Title, Subtitle, MutedText, PermissionBar, GuidedEmptyState,
} from '../components/ui';
import { colors, spacing } from '../theme/theme';

export function CalendarScreen({ navigation }: any) {
  const { user } = useAuth();
  const { household } = useHousehold();
  const { granted, request } = useNotificationPermission();
  const [pets, setPets] = useState<Pet[]>([]);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    getSnoozes().then(setSnoozes);
  }, []);

  const reminders = useUpcomingReminders(pets);
  const now = Date.now();
  const visibleReminders = reminders.filter((r) => !isSnoozed(snoozes, r.id, now));

  const refreshSnoozes = () => getSnoozes().then(setSnoozes);

  const handleDone = async (reminder: UpcomingReminder) => {
    if (!household || !user) return;
    await markDone(firestore, household.id, reminder, user.uid);
  };

  const handleSkip = async (reminder: UpcomingReminder) => {
    if (!household || !user) return;
    await skip(firestore, household.id, reminder, user.uid);
  };

  const handleSnooze = async (reminder: UpcomingReminder) => {
    await snooze(reminder, 3);
    refreshSnoozes();
  };

  return (
    <ScreenContainer style={{ flex: 1 }}>
      {granted === false && (
        <PermissionBar message="Reminders need notifications. Tap to enable." onPress={request} />
      )}
      <Title>Reminders</Title>
      <MutedText>Every vaccine, dose, and follow-up coming up across your pets.</MutedText>
      <Button
        title="Reminder settings"
        variant="outline"
        onPress={() => navigation.navigate('ReminderSettings')}
      />
      <FlatList
        data={visibleReminders}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.xs }}>
            <Subtitle>{item.petName} — {item.label}</Subtitle>
            <MutedText style={item.overdue ? { color: colors.danger, fontWeight: '600' } : undefined}>
              {new Date(item.dueDate).toLocaleDateString()} {item.overdue ? '(overdue)' : ''}
            </MutedText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Done" variant="accent" onPress={() => handleDone(item)} style={{ flex: 1 }} />
              <Button title="Skip" variant="outline" onPress={() => handleSkip(item)} style={{ flex: 1 }} />
              <Button title="Snooze 3d" variant="outline" onPress={() => handleSnooze(item)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="🔔"
            title="Nothing due right now"
            message="Vaccines, medication doses, and vet follow-ups will show up here as they come due."
            actionLabel="Reminder settings"
            onAction={() => navigation.navigate('ReminderSettings')}
          />
        }
      />
    </ScreenContainer>
  );
}
