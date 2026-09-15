import React, { useEffect, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getReminderSettings, setReminderSettings, ReminderSettings, DEFAULT_REMINDER_SETTINGS } from '../reminders/settingsStore';
import { ScreenContainer, Title, Chip, Button, MutedText } from '../components/ui';
import { colors, radii, spacing } from '../theme/theme';

const LEAD_DAY_OPTIONS = [0, 1, 3, 7];

export function ReminderSettingsScreen() {
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

  const handleSave = async () => {
    await setReminderSettings(settings);
    setSaved(true);
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
