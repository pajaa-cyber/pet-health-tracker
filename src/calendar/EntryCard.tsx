import React from 'react';
import { View, Pressable } from 'react-native';
import { CalendarEntry } from './calendarEntries';
import { EVENT_TYPE_EMOJI } from './eventTypes';
import { ReminderType } from '../reminders/computeUpcoming';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { Card, Button, Subtitle, MutedText } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

const REMINDER_EMOJI: Record<ReminderType, string> = {
  vaccine: '💉',
  medication: '💊',
  vetVisitFollowUp: '🩺',
};

interface EntryCardProps {
  entry: CalendarEntry;
  pets: Pet[];
  onDone?: () => void;
  onSkip: () => void;
  onToggleComplete?: () => void;
  onEdit?: () => void;
}

export function EntryCard({ entry, pets, onDone, onSkip, onToggleComplete, onEdit }: EntryCardProps) {
  const emoji = entry.event ? EVENT_TYPE_EMOJI[entry.event.type] : entry.reminder ? REMINDER_EMOJI[entry.reminder.type] : '📌';
  const entryPets = pets.filter((p) => entry.petIds.includes(p.id));

  return (
    <Card style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {entry.source === 'event' && (
          <Pressable
            onPress={onToggleComplete}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: entry.completed }}
            accessibilityLabel={entry.completed ? 'Mark as not done' : 'Mark as done'}
            hitSlop={8}
            style={{
              width: 22, height: 22, borderRadius: 11, borderWidth: 2,
              borderColor: entry.completed ? colors.success : colors.border,
              backgroundColor: entry.completed ? colors.success : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {entry.completed && <MutedText style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>✓</MutedText>}
          </Pressable>
        )}
        <Subtitle>{emoji} {entry.label}</Subtitle>
        {entry.completed && <StatusBadge label="Completed" color={colors.success} />}
        {entry.skipped && <StatusBadge label="Skipped" color={colors.textMuted} />}
      </View>
      <MutedText style={entry.overdue ? { color: colors.danger, fontWeight: '600' } : undefined}>
        {new Date(entry.date).toLocaleDateString()} {entry.overdue ? '(overdue)' : ''}
      </MutedText>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}
        accessible={entryPets.length > 0}
        accessibilityLabel={entryPets.length > 0 ? `For ${entryPets.map((p) => p.name).join(', ')}` : undefined}
      >
        {entryPets.map((pet) => (
          <View key={pet.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: petColor(pet) }} />
            <MutedText>{pet.name}</MutedText>
          </View>
        ))}
      </View>
      {entry.source === 'reminder' ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Done" variant="accent" onPress={onDone} style={{ flex: 1 }} />
          <Button title="Skip" variant="outline" onPress={onSkip} style={{ flex: 1 }} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Skip" variant="outline" onPress={onSkip} style={{ flex: 1 }} />
          <Button title="Edit" variant="outline" onPress={onEdit} style={{ flex: 1 }} />
        </View>
      )}
    </Card>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color, borderRadius: radii.pill, paddingVertical: 2, paddingHorizontal: spacing.sm }}>
      <MutedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>{label}</MutedText>
    </View>
  );
}
