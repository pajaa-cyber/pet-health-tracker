import React, { useEffect, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getReminderSettings, setReminderSettings, ReminderSettings, DEFAULT_REMINDER_SETTINGS } from '../reminders/settingsStore';
import { ScreenContainer, Title, Chip, Button, MutedText } from '../components/ui';
import { colors, radii, spacing } from '../theme/theme';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { computeUpcoming } from '../reminders/computeUpcoming';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToMedications } from '../pets/medicationService';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { rescheduleNotifications } from '../reminders/notificationScheduler';
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Medication } from '../types/medication';
import { VetVisit } from '../types/vetVisit';

const LEAD_DAY_OPTIONS = [0, 1, 3, 7];

export function ReminderSettingsScreen() {
  const { household } = useHousehold();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getReminderSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  // A one-shot fetch-and-compute rather than reusing the live
  // useUpcomingReminders hook, since this screen only needs this once, on
  // save, not a standing subscription for as long as it's mounted.
  const handleSave = async () => {
    await setReminderSettings(settings);
    setSaved(true);
    if (!household) return;
    const pets = activePets(await new Promise<Pet[]>((resolve) => {
      const unsub = subscribeToPets(firestore, household.id, (p) => { resolve(p); unsub(); });
    }));
    const [vaccines, medications, vetVisits] = await Promise.all([
      Promise.all(pets.map((p) => new Promise<Vaccine[]>((resolve) => {
        const unsub = subscribeToVaccines(firestore, household.id, p.id, (v) => { resolve(v); unsub(); });
      }))).then((lists) => lists.flat()),
      Promise.all(pets.map((p) => new Promise<Medication[]>((resolve) => {
        const unsub = subscribeToMedications(firestore, household.id, p.id, (m) => { resolve(m); unsub(); });
      }))).then((lists) => lists.flat()),
      Promise.all(pets.map((p) => new Promise<VetVisit[]>((resolve) => {
        const unsub = subscribeToVetVisits(firestore, household.id, p.id, (v) => { resolve(v); unsub(); });
      }))).then((lists) => lists.flat()),
    ]);
    const reminders = computeUpcoming({ pets, vaccines, medications, vetVisits }, Date.now(), 30);
    await rescheduleNotifications(reminders, settings);
  };

  if (!loaded) {
    return (
      <ScreenContainer>
        <MutedText>Loading…</MutedText>
      </ScreenContainer>
    );
  }

  const timeLabel = new Date(2000, 0, 1, settings.hour, settings.minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <ScreenContainer scroll>
      <Title>How far in advance?</Title>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {LEAD_DAY_OPTIONS.map((days) => (
          <Chip
            key={days}
            label={days === 0 ? 'On the day' : `${days} day${days > 1 ? 's' : ''} before`}
            selected={settings.leadDays === days}
            onPress={() => { setSettings((s) => ({ ...s, leadDays: days })); setSaved(false); }}
          />
        ))}
      </View>

      <Title>What time of day?</Title>
      <Pressable
        onPress={() => setShowTimePicker(true)}
        style={{
          minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md,
          borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
        }}
      >
        <Text style={{ fontSize: 16, color: colors.text }}>{timeLabel}</Text>
      </Pressable>
      {showTimePicker && (
        <DateTimePicker
          value={new Date(2000, 0, 1, settings.hour, settings.minute)}
          mode="time"
          display="default"
          onChange={(_event, selected) => {
            setShowTimePicker(false);
            if (selected) {
              setSettings((s) => ({ ...s, hour: selected.getHours(), minute: selected.getMinutes() }));
              setSaved(false);
            }
          }}
        />
      )}

      <MutedText>
        Reminders are scheduled on this phone, from what this phone has seen. If you use the app on
        more than one phone, each one keeps its own reminder schedule.
      </MutedText>

      <Button title={saved ? 'Saved' : 'Save'} onPress={handleSave} disabled={saved} />
    </ScreenContainer>
  );
}
