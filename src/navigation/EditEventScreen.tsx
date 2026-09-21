import React, { useEffect, useRef, useState } from 'react';
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
  const [notFound, setNotFound] = useState(false);
  // Seeds the form once from the first snapshot that contains the event,
  // then never again — without this, any later snapshot while the form is
  // open (another member's write, that same write's local-then-server echo,
  // or a slow-network double delivery) silently clobbers whatever the user
  // has typed. A ref (not state) so the check inside the listener callback
  // always sees the latest value without needing to be a dependency.
  const loadedEventRef = useRef(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    if (!household) return;
    return subscribeToEvents(firestore, household.id, (events) => {
      if (loadedEventRef.current) return;
      const event = events.find((e) => e.id === eventId);
      if (!event) {
        // onSnapshot always delivers an initial snapshot synchronously (even
        // from cache) — if that first snapshot doesn't contain eventId,
        // there's nothing to wait for: the event was deleted elsewhere or
        // eventId is bad, whether or not the household has any other events
        // (an events.length > 0 guard here previously left a genuinely
        // empty household's first snapshot spinning on "Loading…" forever,
        // since a snapshot that will never contain the event still isn't
        // "no events yet"). Surface not-found instead. A later snapshot
        // could in principle still add a matching event, but once
        // loadedEventRef is never set, we treat "any snapshot with no
        // match" as not-found — simplest correct behavior for this edge
        // case, not a full retry system.
        setNotFound(true);
        return;
      }
      setPetIds(event.petIds);
      setType(event.type);
      setTitle(event.title);
      setNotes(event.notes);
      setDate(event.date);
      setLoaded(true);
      setNotFound(false);
      loadedEventRef.current = true;
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

  if (notFound) {
    return (
      <ScreenContainer>
        <ErrorText>Event not found.</ErrorText>
        <Button title="Go back" onPress={() => navigation.goBack()} />
      </ScreenContainer>
    );
  }

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
