import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { CalendarEntry, daysWithEntries, addDays } from './calendarEntries';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { shell, text } from '../theme/theme';

interface WeekViewProps {
  weekStart: number;
  selectedDate: number;
  entries: CalendarEntry[];
  pets: Pet[];
  onSelectDate: (day: number) => void;
}

const WEEKDAY_LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function WeekView({ weekStart, selectedDate, entries, pets, onSelectDate }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayPetMap = daysWithEntries(entries, weekStart, addDays(weekStart, 7));
  const today = TODAY();

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {days.map((day, i) => {
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
              flex: 1, minHeight: 72, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 2, paddingBottom: 8,
              alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: isSelected ? '#FFFFFF' : shell.card,
              borderWidth: isToday && !isSelected ? 1.5 : 0,
              borderColor: 'rgba(255,255,255,0.45)',
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: isSelected ? shell.bg : text.faint }}>
              {WEEKDAY_LABELS[i]}
            </Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: isSelected ? shell.bg : text.primary }}>
              {new Date(day).getDate()}
            </Text>
            <View style={{ flexDirection: 'row', gap: 3, minHeight: 6 }}>
              {dotPetIds.map((petId) => {
                const pet = pets.find((p) => p.id === petId);
                return (
                  <View
                    key={petId}
                    style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pet ? petColor(pet) : text.faint }}
                  />
                );
              })}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
