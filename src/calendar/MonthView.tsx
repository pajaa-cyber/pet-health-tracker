import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { CalendarEntry, daysWithEntries, startOfWeek, addDays } from './calendarEntries';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { shell, text, spacing } from '../theme/theme';

const GRID_DAYS = 42; // 6 weeks — keeps the grid a fixed height across every month
const WEEKDAY_LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

interface MonthViewProps {
  monthStart: number;
  selectedDate: number;
  entries: CalendarEntry[];
  pets: Pet[];
  onSelectDate: (day: number) => void;
}

export function MonthView({ monthStart, selectedDate, entries, pets, onSelectDate }: MonthViewProps) {
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: GRID_DAYS }, (_, i) => addDays(gridStart, i));
  const dayPetMap = daysWithEntries(entries, gridStart, addDays(gridStart, GRID_DAYS));
  const monthIndex = new Date(monthStart).getMonth();
  const today = TODAY();

  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)' }}>
            {label}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((day) => {
          const inMonth = new Date(day).getMonth() === monthIndex;
          const isSelected = day === selectedDate;
          const isToday = day === today;
          const dotPetIds = (dayPetMap.get(day) ?? []).slice(0, 3);
          return (
            <Pressable
              key={day}
              onPress={() => onSelectDate(day)}
              accessibilityRole="button"
              accessibilityLabel={new Date(day).toDateString()}
              style={{
                width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 2,
              }}
            >
              <View
                style={{
                  width: '100%', height: '100%', minHeight: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 3,
                  backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                  borderWidth: isToday && !isSelected ? 1.5 : 0,
                  borderColor: 'rgba(255,255,255,0.45)',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', opacity: inMonth ? 1 : 0.3, color: isSelected ? shell.bg : text.primary }}>
                  {new Date(day).getDate()}
                </Text>
                <View style={{ flexDirection: 'row', gap: 2, minHeight: 5 }}>
                  {dotPetIds.map((petId) => {
                    const pet = pets.find((p) => p.id === petId);
                    return (
                      <View
                        key={petId}
                        style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: pet ? petColor(pet) : text.faint }}
                      />
                    );
                  })}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
