import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { CalendarEntry } from './calendarEntries';
import { EVENT_TYPE_EMOJI } from './eventTypes';
import { ReminderType } from '../reminders/computeUpcoming';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { Button } from '../components/ui';
import { colors, shell, text, spacing } from '../theme/theme';

const REMINDER_EMOJI: Record<ReminderType, string> = {
  vaccine: '💉',
  medication: '💊',
  vetVisitFollowUp: '🩺',
};

interface EntryCardProps {
  entry: CalendarEntry;
  pets: Pet[];
  // For a reminder: marks it done (reminders have no undo — see
  // reminderActions.ts, clearing the underlying due date makes the
  // reminder disappear entirely, so there is no "Not done" state for
  // these). For an event: toggles completed <-> upcoming: the parent
  // decides the resulting status, this component just relabels the
  // button ("Done" vs "Not done") from entry.completed.
  onDone?: () => void;
  // Toggles skipped <-> upcoming for an event, or performs the
  // one-directional skip for a reminder (see onDone's note — reminders
  // have no reverse). Relabelled ("Skip" vs "Bring back") from
  // entry.skipped.
  onSkip: () => void;
  onEdit?: () => void;
}

export function EntryCard({ entry, pets, onDone, onSkip, onEdit }: EntryCardProps) {
  const emoji = entry.event ? EVENT_TYPE_EMOJI[entry.event.type] : entry.reminder ? REMINDER_EMOJI[entry.reminder.type] : '📌';
  const entryPets = pets.filter((p) => entry.petIds.includes(p.id));
  const rail = entryPets.length > 0 ? petColor(entryPets[0]) : shell.control;

  return (
    <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden', opacity: entry.completed || entry.skipped ? 0.65 : 1 }}>
      <View style={{ width: 5, backgroundColor: rail }} />
      <View style={{ flex: 1, padding: 14, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {entry.source === 'event' && (
            <Pressable
              onPress={onDone}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: entry.completed }}
              accessibilityLabel={entry.completed ? 'Mark as not done' : 'Mark as done'}
              hitSlop={8}
              style={{
                width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                borderColor: entry.completed ? colors.success : 'rgba(255,255,255,0.35)',
                backgroundColor: entry.completed ? colors.success : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {entry.completed && <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>✓</Text>}
            </Pressable>
          )}
          <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary, textDecorationLine: entry.completed ? 'line-through' : 'none', flexShrink: 1 }}>
            {emoji} {entry.label}
          </Text>
          {entry.overdue && <StatusBadge label="Overdue" color="#DC2626" />}
          {entry.completed && <StatusBadge label="Done" color="#059669" />}
          {entry.skipped && <StatusBadge label="Skipped" color="rgba(255,255,255,0.2)" />}
        </View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: entry.overdue ? '#FCA5A5' : text.secondary }}>
          {new Date(entry.date).toLocaleDateString()}
        </Text>
        {entryPets.length > 0 && (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}
            accessible
            accessibilityLabel={`For ${entryPets.map((p) => p.name).join(', ')}`}
          >
            {entryPets.map((pet) => (
              <View key={pet.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: petColor(pet) }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>{pet.name}</Text>
              </View>
            ))}
          </View>
        )}
        {entry.source === 'reminder' ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <Button title="Done" variant="accent" onPress={onDone} style={{ flex: 1 }} />
            <Button
              title="Skip"
              variant="outline"
              borderColor="rgba(255,255,255,0.25)"
              textColor={text.primary}
              onPress={onSkip}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <Button
              title={entry.completed ? 'Not done' : 'Mark done'}
              variant={entry.completed ? 'outline' : 'accent'}
              borderColor={entry.completed ? 'rgba(255,255,255,0.25)' : undefined}
              textColor={entry.completed ? text.primary : undefined}
              onPress={onDone}
              style={{ flex: 1 }}
            />
            <Button
              title={entry.skipped ? 'Bring back' : 'Skip'}
              variant="outline"
              borderColor="rgba(255,255,255,0.25)"
              textColor={text.primary}
              onPress={onSkip}
              style={{ flex: 1 }}
            />
            <Button
              title="Edit"
              variant="outline"
              borderColor="rgba(255,255,255,0.25)"
              textColor={text.primary}
              onPress={onEdit}
              style={{ flex: 1 }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 10 }}>{label}</Text>
    </View>
  );
}
