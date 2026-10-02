import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { getPet, updatePet, updatePetPhoto } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet, DatePrecision, ArrivalPrecision } from '../types/pet';
import { SPECIES_LIST, SPECIES_LABEL, SPECIES_EMOJI } from '../pets/species';
import { DateField } from '../components/DateField';
import {
  ScreenContainer, TextField, Button, ErrorText, Chip, AvatarPicker,
  Title, MutedText, GracefulDateField, BreedPicker,
} from '../components/ui';
import { spacing, colors } from '../theme/theme';
import { canAddCustomField, customFieldLimitMessage } from '../limits/limits';

export function EditPetScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [pet, setPet] = useState<Pet | null>(null);
  const [breedPickerOpen, setBreedPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    getPet(firestore, household.id, petId).then(setPet);
  }, [household, petId]);

  const patch = (updates: Partial<Pet>) => setPet((p) => (p ? { ...p, ...updates } : p));

  const handleSave = async () => {
    if (!household || !pet) return;
    setError(null);
    setLoading(true);
    try {
      const { id, householdId, photoUrl, colorKey, ...updates } = pet;
      await updatePet(firestore, household.id, petId, updates);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!pet) {
    return (
      <ScreenContainer>
        <MutedText>Loading…</MutedText>
      </ScreenContainer>
    );
  }

  const isRemembered = pet.status === 'remembered';

  return (
    <ScreenContainer scroll>
      <AvatarPicker
        photoUri={pet.photoUrl}
        fallbackEmoji={SPECIES_EMOJI[pet.species]}
        onPicked={(uri) => {
          if (!household) return;
          updatePetPhoto(firestore, household.id, petId, uri);
          patch({ photoUrl: uri });
        }}
      />
      <TextField label="Name" value={pet.name} onChangeText={(t) => patch({ name: t })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {SPECIES_LIST.map((s) => (
          <Chip key={s} label={`${SPECIES_EMOJI[s]} ${SPECIES_LABEL[s]}`} selected={pet.species === s} onPress={() => patch({ species: s })} />
        ))}
      </View>
      {pet.species === 'other' && (
        <TextField label="What kind?" value={pet.speciesOther ?? ''} onChangeText={(t) => patch({ speciesOther: t })} />
      )}
      <Button title={pet.breed || 'Choose a breed'} variant="outline" onPress={() => setBreedPickerOpen(true)} />
      <BreedPicker
        visible={breedPickerOpen}
        species={pet.species}
        value={pet.breed}
        onSelect={(b) => patch({ breed: b })}
        onClose={() => setBreedPickerOpen(false)}
      />
      <GracefulDateField
        label="Birth date"
        options={['exact', 'roughly', 'approxAge', 'unknown']}
        precision={pet.birthDatePrecision ?? 'exact'}
        date={pet.birthDate}
        approximateAgeMonths={pet.approximateAgeMonths}
        onChange={({ precision, date, approximateAgeMonths }) =>
          patch({ birthDatePrecision: precision as DatePrecision, birthDate: date, approximateAgeMonths })
        }
      />
      <GracefulDateField
        label="Arrival date"
        options={['exact', 'roughly', 'unknown']}
        precision={pet.arrivalDatePrecision}
        date={pet.arrivalDate}
        approximateAgeMonths={null}
        onChange={({ precision, date }) => patch({ arrivalDatePrecision: precision as ArrivalPrecision, arrivalDate: date })}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(['male', 'female', 'unknown'] as const).map((s) => (
          <Chip key={s} label={s} selected={pet.sex === s} onPress={() => patch({ sex: s })} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Chip label="Neutered: Yes" selected={pet.neutered === true} onPress={() => patch({ neutered: true })} />
        <Chip label="Neutered: No" selected={pet.neutered === false} onPress={() => patch({ neutered: false })} />
        <Chip label="Don't know" selected={pet.neutered === null} onPress={() => patch({ neutered: null })} />
      </View>
      <TextField label="Colour / markings" value={pet.colorMarkings ?? ''} onChangeText={(t) => patch({ colorMarkings: t })} />
      <TextField label="Allergies" value={pet.allergies ?? ''} onChangeText={(t) => patch({ allergies: t })} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(['indoor', 'outdoor', 'both'] as const).map((e) => (
          <Chip
            key={e}
            label={e}
            selected={pet.livingEnvironment === e}
            onPress={() => patch({ livingEnvironment: pet.livingEnvironment === e ? null : e })}
          />
        ))}
      </View>
      <TextField label="Microchip provider" value={pet.microchipProvider ?? ''} onChangeText={(t) => patch({ microchipProvider: t })} scrollToEnd />
      <TextField label="Microchip number" value={pet.microchipNumber ?? ''} onChangeText={(t) => patch({ microchipNumber: t })} scrollToEnd />
      <DateField
        label="Microchip date implanted"
        value={pet.microchipDate}
        onChange={(v) => patch({ microchipDate: v })}
        onClear={() => patch({ microchipDate: null })}
      />
      {/* This whole tail cluster (microchip registry through the last custom
          field) sits right above Save with nothing below it to scroll
          into — the same "field itself scrolls into view but Save and
          whatever's after it stays under the keyboard" shape already fixed
          elsewhere (Add a Blood Test's last marker row, Prepare for Vet)
          via scrollToEnd, just never applied here. Reported live on-device. */}
      <TextField label="Microchip registry" value={pet.microchipRegistry ?? ''} onChangeText={(t) => patch({ microchipRegistry: t })} scrollToEnd />
      <Title>Custom fields</Title>
      {(pet.customFields ?? []).map((f, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Label"
              value={f.label}
              onChangeText={(t) => patch({ customFields: (pet.customFields ?? []).map((cf, j) => (j === i ? { ...cf, label: t } : cf)) })}
              scrollToEnd
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Value"
              value={f.value}
              onChangeText={(t) => patch({ customFields: (pet.customFields ?? []).map((cf, j) => (j === i ? { ...cf, value: t } : cf)) })}
              scrollToEnd
            />
          </View>
          <Button
            title="Remove"
            variant="outline"
            onPress={() => patch({ customFields: (pet.customFields ?? []).filter((_, j) => j !== i) })}
          />
        </View>
      ))}
      <Button
        title={!canAddCustomField(pet, household ?? { trialEndsAt: null }) ? customFieldLimitMessage() : 'Add a custom field'}
        variant="outline"
        disabled={!canAddCustomField(pet, household ?? { trialEndsAt: null })}
        onPress={() => patch({ customFields: [...(pet.customFields ?? []), { label: '', value: '' }] })}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Save changes" onPress={handleSave} loading={loading} />
      {/* Marking a pet remembered in the first place has no UI entry point
          anywhere now, by request — a single accidental tap on it used to
          move a pet off every active list in the app with no confirmation,
          which read as the pet having been deleted. A pet that's already
          remembered (from before this change) still needs a one-tap way
          back, so that direction alone stays. */}
      {isRemembered && (
        <>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
          <Button
            title="Mark as active again"
            variant="outline"
            onPress={() => {
              if (!household) return;
              updatePet(firestore, household.id, petId, { status: 'active' });
              patch({ status: 'active' });
            }}
          />
          <MutedText>{`${pet.name} will be moved out of your active pets list. Their records are kept safe and can be restored anytime with this same button.`}</MutedText>
        </>
      )}
      {/* This form's content sits right at one screen's height without a
          keyboard open (confirmed via debug logging: scrollToEnd() was
          firing with a valid ScrollView ref every time, but the native
          view had no extra scrollable range to move into once the
          keyboard opened) — the same shape already fixed this way on Add
          a Blood Test and Prepare for Vet. A fixed spacer guarantees
          content is always taller than any visible area, so scrolling
          stays consistently available. Found live on-device: the
          Microchip section and Custom fields were unreachable past the
          keyboard. */}
      <View style={{ height: 280 }} />
    </ScreenContainer>
  );
}
