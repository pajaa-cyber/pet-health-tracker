import React, { useEffect, useState } from 'react';
import { View, BackHandler } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createPet, updatePetPhoto, subscribeToPets, NewPetInput } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet, PetSpecies, DatePrecision, ArrivalPrecision } from '../types/pet';
import { SPECIES_LIST, SPECIES_LABEL, SPECIES_EMOJI } from '../pets/species';
import {
  ScreenContainer, TextField, Button, ErrorText, Chip, AvatarPicker,
  Title, MutedText, GracefulDateField, BreedPicker,
} from '../components/ui';
import { spacing } from '../theme/theme';
import { canAddCustomField, customFieldLimitMessage } from '../limits/limits';
import { DateField } from '../components/DateField';

type WizardData = NewPetInput & { photoDataUri: string | null };

const INITIAL: WizardData = {
  name: '', species: 'dog', speciesOther: null, breed: '',
  birthDate: Date.now(), birthDatePrecision: 'exact', approximateAgeMonths: null,
  arrivalDate: null, arrivalDatePrecision: null,
  sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
  microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
  customFields: [], status: 'active', photoDataUri: null,
};

const TOTAL_STEPS = 9; // 0-indexed steps 0..8; Task 9 adds the final review step (index 8)

export function AddPetScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [existingPets, setExistingPets] = useState<Pet[]>([]);
  const [breedPickerOpen, setBreedPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setExistingPets);
  }, [household]);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));
  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // The hardware/gesture back button pops the whole screen by default,
  // discarding every step's answers — intercept it so it steps the wizard
  // backward instead, matching the in-app Back button, and only actually
  // leaves the screen once the user is on step 0.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        back();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [step]);

  const handleSave = async () => {
    if (!household) return;
    setError(null);
    setLoading(true);
    try {
      const { photoDataUri, ...input } = data;
      const pet = await createPet(firestore, household.id, input, existingPets);
      if (photoDataUri) {
        await updatePetPhoto(firestore, household.id, pet.id, photoDataUri);
      }
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const petName = data.name.trim() || 'your pet';

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Title>Let's add a pet</Title>
            <AvatarPicker photoUri={data.photoDataUri} onPicked={(uri) => update({ photoDataUri: uri })} />
            <TextField label="Name" placeholder="Pet's name" value={data.name} onChangeText={(t) => update({ name: t })} />
          </>
        );
      case 1:
        return (
          <>
            <Title>{`What kind of animal is ${petName}?`}</Title>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SPECIES_LIST.map((s) => (
                <Chip
                  key={s}
                  label={`${SPECIES_EMOJI[s]} ${SPECIES_LABEL[s]}`}
                  selected={data.species === s}
                  onPress={() => update({ species: s, speciesOther: s === 'other' ? data.speciesOther : null })}
                />
              ))}
            </View>
            {data.species === 'other' && (
              <TextField
                label="What kind?"
                placeholder="e.g. Guinea pig, tortoise..."
                value={data.speciesOther ?? ''}
                onChangeText={(t) => update({ speciesOther: t })}
              />
            )}
          </>
        );
      case 2:
        return (
          <>
            <Title>{`${petName}'s breed`}</Title>
            <MutedText>Not sure, or not a specific breed? That's completely fine — pick Mixed, Stray or rescued, or Don't know.</MutedText>
            <Button
              title={data.breed || 'Choose a breed (optional)'}
              variant="outline"
              onPress={() => setBreedPickerOpen(true)}
            />
            <BreedPicker
              visible={breedPickerOpen}
              species={data.species}
              value={data.breed}
              onSelect={(b) => update({ breed: b })}
              onClose={() => setBreedPickerOpen(false)}
            />
          </>
        );
      case 3:
        return (
          <>
            <Title>{`When was ${petName} born?`}</Title>
            <GracefulDateField
              label="Birth date"
              options={['exact', 'roughly', 'approxAge', 'unknown']}
              precision={data.birthDatePrecision}
              date={data.birthDate}
              approximateAgeMonths={data.approximateAgeMonths}
              onChange={({ precision, date, approximateAgeMonths }) =>
                update({ birthDatePrecision: precision as DatePrecision, birthDate: date, approximateAgeMonths })
              }
            />
          </>
        );
      case 4:
        return (
          <>
            <Title>{`When did ${petName} join your care?`}</Title>
            <MutedText>Optional — skip this if you'd rather not answer.</MutedText>
            <GracefulDateField
              label="Arrival date"
              options={['exact', 'roughly', 'unknown']}
              precision={data.arrivalDatePrecision}
              date={data.arrivalDate}
              approximateAgeMonths={null}
              onChange={({ precision, date }) =>
                update({ arrivalDatePrecision: precision as ArrivalPrecision, arrivalDate: date })
              }
            />
            <Button
              title="Skip"
              variant="outline"
              onPress={() => update({ arrivalDatePrecision: null, arrivalDate: null })}
            />
          </>
        );
      case 5:
        return (
          <>
            <Title>{`About ${petName}`}</Title>
            <View style={{ gap: spacing.xs }}>
              <MutedText>Sex — helps tailor care reminders.</MutedText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['male', 'female', 'unknown'] as const).map((s) => (
                  <Chip key={s} label={s} selected={data.sex === s} onPress={() => update({ sex: s })} />
                ))}
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <MutedText>Neutered / spayed — some vaccines and medications are dosed differently.</MutedText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Chip label="Yes" selected={data.neutered === true} onPress={() => update({ neutered: true })} />
                <Chip label="No" selected={data.neutered === false} onPress={() => update({ neutered: false })} />
                <Chip label="Don't know" selected={data.neutered === null} onPress={() => update({ neutered: null })} />
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <MutedText>Helps identify your pet if they're ever lost, and confirms it's them for vets or a microchip registry.</MutedText>
              <TextField
                label="Colour / markings (optional)"
                value={data.colorMarkings}
                onChangeText={(t) => update({ colorMarkings: t })}
              />
            </View>
            <View style={{ gap: spacing.xs }}>
              <MutedText>Where do they spend their time? This changes flea/tick/worm risk, so protection can be tailored to match.</MutedText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['indoor', 'outdoor', 'both'] as const).map((e) => (
                  <Chip key={e} label={e} selected={data.livingEnvironment === e} onPress={() => update({ livingEnvironment: e })} />
                ))}
              </View>
            </View>
          </>
        );
      case 6:
        return (
          <>
            <Title>Microchip</Title>
            <MutedText>Optional — add this now or anytime from the pet's profile.</MutedText>
            <TextField label="Provider" value={data.microchipProvider} onChangeText={(t) => update({ microchipProvider: t })} />
            <TextField label="Chip number" value={data.microchipNumber} onChangeText={(t) => update({ microchipNumber: t })} />
            <DateField
              label="Date implanted"
              value={data.microchipDate}
              onChange={(v) => update({ microchipDate: v })}
              onClear={() => update({ microchipDate: null })}
            />
            <TextField label="Registry" value={data.microchipRegistry} onChangeText={(t) => update({ microchipRegistry: t })} />
          </>
        );
      case 7: {
        const atLimit = !canAddCustomField(data);
        return (
          <>
            <Title>Custom fields</Title>
            <MutedText>Add your own fields — favourite food, walking route, anything you want to remember.</MutedText>
            {data.customFields.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                {/* TextField's `style` prop only reaches the inner TextInput, not its
                    outer wrapper View — flex:1 there has no effect on width since the
                    wrapper is a plain column View. Wrapping each TextField in its own
                    flex:1 View lets the wrapper stretch (default alignItems: 'stretch')
                    to fill this row's cell, which is what actually makes these inputs
                    usable width instead of collapsing to a ~14px box. */}
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Label"
                    value={f.label}
                    onChangeText={(t) => update({ customFields: data.customFields.map((cf, j) => (j === i ? { ...cf, label: t } : cf)) })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Value"
                    value={f.value}
                    onChangeText={(t) => update({ customFields: data.customFields.map((cf, j) => (j === i ? { ...cf, value: t } : cf)) })}
                  />
                </View>
                <Button
                  title="Remove"
                  variant="outline"
                  onPress={() => update({ customFields: data.customFields.filter((_, j) => j !== i) })}
                />
              </View>
            ))}
            <Button
              title={atLimit ? customFieldLimitMessage() : 'Add a custom field'}
              variant="outline"
              disabled={atLimit}
              onPress={() => update({ customFields: [...data.customFields, { label: '', value: '' }] })}
            />
          </>
        );
      }
      case 8: {
        const Row = ({ label, value, jumpTo }: { label: string; value: string; jumpTo: number }) => (
          <Chip label={`${label}: ${value || '—'}`} selected={false} onPress={() => setStep(jumpTo)} />
        );
        return (
          <>
            <Title>Review</Title>
            <MutedText>Tap anything to change it.</MutedText>
            <View style={{ gap: spacing.xs }}>
              <Row label="Name" value={data.name} jumpTo={0} />
              <Row label="Species" value={data.species === 'other' ? (data.speciesOther ?? '') : SPECIES_LABEL[data.species]} jumpTo={1} />
              <Row label="Breed" value={data.breed} jumpTo={2} />
              <Row label="Birth date" value={data.birthDate ? new Date(data.birthDate).toLocaleDateString() : "Don't know"} jumpTo={3} />
              <Row label="Arrival date" value={data.arrivalDate ? new Date(data.arrivalDate).toLocaleDateString() : 'Not set'} jumpTo={4} />
              <Row label="Sex" value={data.sex} jumpTo={5} />
              <Row label="Neutered" value={data.neutered === null ? "Don't know" : data.neutered ? 'Yes' : 'No'} jumpTo={5} />
              <Row label="Colour / markings" value={data.colorMarkings} jumpTo={5} />
              <Row label="Environment" value={data.livingEnvironment ?? 'Not set'} jumpTo={5} />
              <Row label="Microchip" value={data.microchipNumber} jumpTo={6} />
              <Row label="Custom fields" value={String(data.customFields.length)} jumpTo={7} />
            </View>
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <ScreenContainer scroll>
      <MutedText>{`Step ${step + 1} of ${TOTAL_STEPS}`}</MutedText>
      {renderStep()}
      {error && <ErrorText>{error}</ErrorText>}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {step > 0 && <Button title="Back" variant="outline" onPress={back} style={{ flex: 1 }} />}
        {step < TOTAL_STEPS - 1 ? (
          <Button title="Next" onPress={next} style={{ flex: 1 }} />
        ) : (
          <Button title="Add pet" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
        )}
      </View>
    </ScreenContainer>
  );
}
