import React from 'react';
import { View, Pressable } from 'react-native';
import { CalendarEntry, daysWithEntries } from './calendarEntries';
import { MutedText, BodyText } from '../components/ui';
import { colors, radii, spacing } from '../theme/theme';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface WeekViewProps {
  weekStart: number;
  selectedDate: number;
  entries: CalendarEntry[];
  onSelectDate: (day: number) => void;
}

export function WeekView({ weekStart, selectedDate, entries, onSelectDate }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY_MS);
  const markedDays = new Set(daysWithEntries(entries, weekStart, weekStart + 7 * DAY_MS));

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((day, i) => {
        const isSelected = day === selectedDate;
        return (
          <Pressable
            key={day}
            onPress={() => onSelectDate(day)}
            accessibilityRole="button"
            accessibilityLabel={new Date(day).toDateString()}
            style={{
              alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
              borderRadius: radii.md, backgroundColor: isSelected ? colors.primary : 'transparent', minWidth: 40,
            }}
          >
            <MutedText style={isSelected ? { color: '#FFFFFF' } : undefined}>{WEEKDAY_LABELS[i]}</MutedText>
            <BodyText style={{ fontWeight: '700', color: isSelected ? '#FFFFFF' : colors.text }}>
              {new Date(day).getDate()}
            </BodyText>
            <View
              style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: markedDays.has(day) ? (isSelected ? '#FFFFFF' : colors.accent) : 'transparent',
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
