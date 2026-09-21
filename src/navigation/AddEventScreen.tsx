import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { createEvent } from '../calendar/eventService';
import { EVENT_TYPE_LIST, EVENT_TYPE_LABEL, EVENT_TYPE_EMOJI } from '../calendar/eventTypes';
import { EventType } from '../types/calendarEvent';
import { firestore } from '../firebase/config';
import { DateField } from '../components/DateField';
import { petColor } from '../theme/petColors';
import { Pet } from '../types/pet';
import { ScreenContainer, TextField, Button, Chip, Title, BodyText, ErrorText, GuidedEmptyState } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

const STEPS = ['Who is it for?', 'What kind of event?', 'Details'] as const;

export function AddEventScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
  const [step, setStep] = useState(0);
  const [petIds, setPetIds] = useState<string[]>([]);
  const [type, setType] = useState<EventType | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  const togglePet = (petId: string) => {
    setPetIds((prev) => (prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]));
  };

  const canProceed = step === 0 ? petIds.length > 0 : step === 1 ? type !== null : title.trim().length > 0;

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!household || !type) return;
    setError(null);
    setLoading(true);
    try {
      await createEvent(firestore, household.id, petIds, type, title, notes, date);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <Title>{STEPS[step]}</Title>

      {step === 0 && pets.length === 0 && (
        <GuidedEmptyState
          emoji="🐾"
          title="No pets yet"
          message="Add a pet first, then come back to put an event on their calendar."
          actionLabel="Add a Pet"
          onAction={() => navigation.navigate('PetsTab', { screen: 'AddPet' })}
        />
      )}

      {step === 0 && pets.length > 0 && (
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
                <BodyText>{pet.name}</BodyText>
              </Pressable>
            );
          })}
        </View>
      )}

      {step === 1 && (
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
      )}

      {step === 2 && (
        <View style={{ gap: spacing.md }}>
          <TextField label="Title" placeholder="e.g. Nail trim" value={title} onChangeText={setTitle} />
          <TextField label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 96, textAlignVertical: 'top' }} />
          <DateField label="Date" value={date} onChange={setDate} />
        </View>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {step > 0 && <Button title="Back" variant="outline" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
        <Button
          title={step === STEPS.length - 1 ? 'Add event' : 'Next'}
          onPress={handleNext}
          disabled={!canProceed}
          loading={loading}
          style={{ flex: 1 }}
        />
      </View>
    </ScreenContainer>
  );
}
