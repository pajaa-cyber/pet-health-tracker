import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToEvents, createEvent } from '../calendar/eventService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { CalendarEvent, EventType } from '../types/calendarEvent';
import { Pet } from '../types/pet';
import { PREVENTIVE_CARE_TYPES, lastDoneByType } from '../pets/preventiveCare';
import { EVENT_TYPE_LABEL, EVENT_TYPE_EMOJI } from '../calendar/eventTypes';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, ErrorText } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

function formatExactDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function HygieneScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loggingType, setLoggingType] = useState<EventType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToEvents(firestore, household.id, setEvents);
  }, [household]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const lastDone = lastDoneByType(events, petId);
  const rail = pet ? petColor(pet) : shell.control;

  // Tapping a row both logs it (a plain CalendarEvent, already status:
  // 'completed') and is how you see the exact date/time it was done — the
  // row's own subtitle switches from "Not logged yet" to that timestamp the
  // moment the write lands, via the live events subscription above.
  const handleLog = async (type: EventType) => {
    if (!household) return;
    setError(null);
    setLoggingType(type);
    try {
      await createEvent(firestore, household.id, [petId], type, EVENT_TYPE_LABEL[type], '', Date.now(), 'completed');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoggingType(null);
    }
  };

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Hygiene"
        subtitle={`${pet?.name ?? 'Pet'} · tap an item to log it now`}
        onBack={() => navigation.goBack()}
      />
      {error && (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorText>{error}</ErrorText>
        </View>
      )}
      <FlatList
        data={PREVENTIVE_CARE_TYPES}
        keyExtractor={(t) => t}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item: careType }) => {
          const done = lastDone[careType];
          const logging = loggingType === careType;
          return (
            <Pressable
              onPress={() => handleLog(careType)}
              disabled={logging}
              accessibilityRole="button"
              accessibilityLabel={`Log ${EVENT_TYPE_LABEL[careType]} done now`}
              style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden', opacity: logging ? 0.6 : 1 }}
            >
              <View style={{ width: 6, backgroundColor: rail }} />
              <View style={{ flex: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 19 }}>{EVENT_TYPE_EMOJI[careType]}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{EVENT_TYPE_LABEL[careType]}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                    {done != null ? formatExactDateTime(done) : 'Not logged yet — tap to log now'}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}
