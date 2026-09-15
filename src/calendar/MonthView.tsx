import React from 'react';
import { View, Pressable } from 'react-native';
import { CalendarEntry, daysWithEntries, startOfWeek } from './calendarEntries';
import { MutedText, BodyText } from '../components/ui';
import { colors, radii, spacing } from '../theme/theme';

const DAY_MS = 24 * 60 * 60 * 1000;
const GRID_DAYS = 42; // 6 weeks — keeps the grid a fixed height across every month
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface MonthViewProps {
  monthStart: number;
  selectedDate: number;
  entries: CalendarEntry[];
  onSelectDate: (day: number) => void;
}

export function MonthView({ monthStart, selectedDate, entries, onSelectDate }: MonthViewProps) {
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: GRID_DAYS }, (_, i) => gridStart + i * DAY_MS);
  const markedDays = new Set(daysWithEntries(entries, gridStart, gridStart + GRID_DAYS * DAY_MS));
  const monthIndex = new Date(monthStart).getMonth();

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        {WEEKDAY_LABELS.map((label, i) => (
          <MutedText key={i} style={{ width: `${100 / 7}%`, textAlign: 'center' }}>{label}</MutedText>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((day) => {
          const inMonth = new Date(day).getMonth() === monthIndex;
          const isSelected = day === selectedDate;
          return (
            <Pressable
              key={day}
              onPress={() => onSelectDate(day)}
              accessibilityRole="button"
              accessibilityLabel={new Date(day).toDateString()}
              style={{
                width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2,
                borderRadius: radii.md, backgroundColor: isSelected ? colors.primary : 'transparent',
              }}
            >
              <BodyText style={{ opacity: inMonth ? 1 : 0.35, color: isSelected ? '#FFFFFF' : colors.text, fontWeight: isSelected ? '700' : '400' }}>
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
    </View>
  );
}
