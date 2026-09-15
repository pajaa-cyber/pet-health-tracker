import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { subscribeToEvents, updateEvent } from '../calendar/eventService';
import { EVENT_TYPE_LIST, EVENT_TYPE_LABEL, EVENT_TYPE_EMOJI } from '../calendar/eventTypes';
import { EventType } from '../types/calendarEvent';
import { firestore } from '../firebase/config';
import { DateField } from '../components/DateField';
import { petColor } from '../theme/petColors';
import { Pet } from '../types/pet';
import { ScreenContainer, TextField, Button, Chip, MutedText, ErrorText } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

export function EditEventScreen({ route, navigation }: any) {
  const { eventId } = route.params;
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [petIds, setPetIds] = useState<string[]>([]);
  const [type, setType] = useState<EventType | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    if (!household) return;
    return subscribeToEvents(firestore, household.id, (events) => {
      const event = events.find((e) => e.id === eventId);
      if (!event) return;
      setPetIds(event.petIds);
      setType(event.type);
      setTitle(event.title);
      setNotes(event.notes);
      setDate(event.date);
      setLoaded(true);
    });
  }, [household, eventId]);

  const togglePet = (petId: string) => {
    setPetIds((prev) => (prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]));
  };

  const handleSave = async () => {
    if (!household || !type) return;
    setError(null);
    setSaving(true);
    try {
      await updateEvent(firestore, household.id, eventId, { petIds, type, title, notes, date });
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <ScreenContainer>
        <MutedText>Loading…</MutedText>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <MutedText>Who is it for?</MutedText>
      <View style={{ gap: spacing.sm }}>
        {pets.map((pet) => {
          const selected = petIds.includes(pet.id);
          return (
            <Pressable
              key={pet.id}
              onPress={() => togglePet(pet.id)}
              accessibilityRole="button"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md,
                borderRadius: radii.md, borderWidth: 1.5,
                borderColor: selected ? petColor(pet) : colors.border,
                backgroundColor: selected ? colors.surfaceTint : colors.surface,
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: petColor(pet) }} />
              <MutedText>{pet.name}</MutedText>
            </Pressable>
          );
        })}
      </View>

      <MutedText>Event type</MutedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {EVENT_TYPE_LIST.map((t) => (
          <Chip
            key={t}
            label={`${EVENT_TYPE_EMOJI[t]} ${EVENT_TYPE_LABEL[t]}`}
            selected={type === t}
            onPress={() => setType(t)}
          />
        ))}
      </View>

      <TextField label="Title" value={title} onChangeText={setTitle} />
      <TextField label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 96, textAlignVertical: 'top' }} />
      <DateField label="Date" value={date} onChange={setDate} />

      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Save" onPress={handleSave} loading={saving} disabled={petIds.length === 0 || !type || title.trim().length === 0} />
    </ScreenContainer>
  );
}
