import React, { useEffect, useState } from 'react';
import { View, BackHandler, Pressable, Text, TextInput } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { createPet, updatePetPhoto, subscribeToPets, NewPetInput } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet, PetSpecies, DatePrecision, ArrivalPrecision } from '../types/pet';
import { SPECIES_LIST, SPECIES_LABEL, SPECIES_EMOJI } from '../pets/species';
import { ScreenContainer, ErrorText, Chip, AvatarPicker, GracefulDateField, BreedPicker } from '../components/ui';
import { shell, spacing } from '../theme/theme';
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

const TOTAL_STEPS = 9;
const WIZARD_TINTS = ['#5B4BE8', '#EC1E63', '#F97316', '#14B8A6', '#7C3AED', '#0EA5E9', '#F43F5E', '#0F9D58', '#5B4BE8'];

// A local, wizard-only outline button — the shared `Button` component's
// variants don't have a "white outline on an arbitrary coloured
// background" option, and adding one there for a single screen isn't
// worth widening that component's API. Used for every wizard "secondary"
// action: the breed-picker trigger, Skip, and the custom-fields Remove/Add
// buttons.
function WizardButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 44, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{title}</Text>
    </Pressable>
  );
}

// The wizard's dark text-input treatment — rgba(255,255,255,0.18) fill, no
// border, white text. Hand-rolled rather than extending the shared
// `TextField` (bordered, white-bg, dark text) because the two look nothing
// alike; `TextField` stays exactly as it is for every other screen.
function WizardTextField({ label, value, onChangeText, placeholder, keyboardType }: {
  label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.45)"
        keyboardType={keyboardType}
        style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, padding: 14, fontSize: 16, fontWeight: '600', color: '#FFFFFF', minHeight: 48 }}
      />
    </View>
  );
}

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
  const tint = WIZARD_TINTS[step];

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
      // Lands on the new pet's hub (Part A's design decision) rather than
      // going back — shows off the just-assigned identity colour immediately.
      navigation.replace('PetHome', { petId: pet.id });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const petName = data.name.trim() || 'your pet';

  // Every chip on every step uses the same selected/unselected colour pair —
  // Chip itself already branches on each chip's own `selected` prop, so this
  // is a plain constant, not a function of any individual chip's state.
  const stepChip = { selectedBg: '#FFFFFF', selectedColor: tint, unselectedBg: 'rgba(255,255,255,0.18)', unselectedColor: '#FFFFFF' };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>Let's add a pet</Text>
            <AvatarPicker
              photoUri={data.photoDataUri}
              onPicked={(uri) => update({ photoDataUri: uri })}
              size={116}
              emojiSize={34}
              backgroundColor="rgba(255,255,255,0.2)"
              borderColor="rgba(255,255,255,0.55)"
              borderWidth={3}
              borderStyle="dashed"
              caption="mono"
              captionColor="rgba(255,255,255,0.85)"
            />
            <TextInput
              value={data.name}
              onChangeText={(t) => update({ name: t })}
              placeholder="Pet's name"
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={{
                fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center',
                borderBottomWidth: 2, borderBottomColor: 'rgba(255,255,255,0.5)', paddingBottom: 8, backgroundColor: 'transparent',
              }}
            />
          </>
        );
      case 1:
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>{`What kind of animal is ${petName}?`}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SPECIES_LIST.map((s) => (
                <Chip
                  key={s}
                  label={`${SPECIES_EMOJI[s]} ${SPECIES_LABEL[s]}`}
                  selected={data.species === s}
                  onPress={() => update({ species: s, speciesOther: s === 'other' ? data.speciesOther : null })}
                  {...stepChip}
                />
              ))}
            </View>
            {data.species === 'other' && (
              <WizardTextField
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
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>{`${petName}'s breed`}</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', maxWidth: 300 }}>
              Not sure, or not a specific breed? That's completely fine — pick Mixed, Stray or rescued, or Don't know.
            </Text>
            <WizardButton title={data.breed || 'Choose a breed (optional)'} onPress={() => setBreedPickerOpen(true)} />
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
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>{`When was ${petName} born?`}</Text>
            <GracefulDateField
              label="Birth date"
              options={['exact', 'roughly', 'approxAge', 'unknown']}
              precision={data.birthDatePrecision}
              date={data.birthDate}
              approximateAgeMonths={data.approximateAgeMonths}
              onChange={({ precision, date, approximateAgeMonths }) =>
                update({ birthDatePrecision: precision as DatePrecision, birthDate: date, approximateAgeMonths })
              }
              tint={tint}
            />
          </>
        );
      case 4:
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>{`When did ${petName} join your care?`}</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', maxWidth: 300 }}>Optional — skip this if you'd rather not answer.</Text>
            <GracefulDateField
              label="Arrival date"
              options={['exact', 'roughly', 'unknown']}
              precision={data.arrivalDatePrecision}
              date={data.arrivalDate}
              approximateAgeMonths={null}
              onChange={({ precision, date }) =>
                update({ arrivalDatePrecision: precision as ArrivalPrecision, arrivalDate: date })
              }
              tint={tint}
            />
            <WizardButton title="Skip" onPress={() => update({ arrivalDatePrecision: null, arrivalDate: null })} />
          </>
        );
      case 5:
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>{`About ${petName}`}</Text>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.85)' }}>Sex — helps tailor care reminders.</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['male', 'female', 'unknown'] as const).map((s) => (
                  <Chip key={s} label={s} selected={data.sex === s} onPress={() => update({ sex: s })} {...stepChip} />
                ))}
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.85)' }}>Neutered / spayed — some vaccines and medications are dosed differently.</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Chip label="Yes" selected={data.neutered === true} onPress={() => update({ neutered: true })} {...stepChip} />
                <Chip label="No" selected={data.neutered === false} onPress={() => update({ neutered: false })} {...stepChip} />
                <Chip label="Don't know" selected={data.neutered === null} onPress={() => update({ neutered: null })} {...stepChip} />
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.85)' }}>
                Helps identify your pet if they're ever lost, and confirms it's them for vets or a microchip registry.
              </Text>
              <WizardTextField
                label="Colour / markings (optional)"
                value={data.colorMarkings}
                onChangeText={(t) => update({ colorMarkings: t })}
              />
            </View>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.85)' }}>
                Where do they spend their time? This changes flea/tick/worm risk, so protection can be tailored to match.
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['indoor', 'outdoor', 'both'] as const).map((e) => (
                  <Chip key={e} label={e} selected={data.livingEnvironment === e} onPress={() => update({ livingEnvironment: e })} {...stepChip} />
                ))}
              </View>
            </View>
          </>
        );
      case 6:
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>Microchip</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', maxWidth: 300 }}>Optional — add this now or anytime from the pet's profile.</Text>
            <WizardTextField label="Provider" value={data.microchipProvider} onChangeText={(t) => update({ microchipProvider: t })} />
            <WizardTextField label="Chip number" value={data.microchipNumber} onChangeText={(t) => update({ microchipNumber: t })} />
            <DateField
              label="Date implanted"
              value={data.microchipDate}
              onChange={(v) => update({ microchipDate: v })}
              onClear={() => update({ microchipDate: null })}
            />
            <WizardTextField label="Registry" value={data.microchipRegistry} onChangeText={(t) => update({ microchipRegistry: t })} />
          </>
        );
      case 7: {
        const atLimit = !canAddCustomField(data);
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>Custom fields</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', maxWidth: 300 }}>
              Add your own fields — favourite food, walking route, anything you want to remember.
            </Text>
            {data.customFields.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <WizardTextField
                    label="Label"
                    value={f.label}
                    onChangeText={(t) => update({ customFields: data.customFields.map((cf, j) => (j === i ? { ...cf, label: t } : cf)) })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <WizardTextField
                    label="Value"
                    value={f.value}
                    onChangeText={(t) => update({ customFields: data.customFields.map((cf, j) => (j === i ? { ...cf, value: t } : cf)) })}
                  />
                </View>
                <Pressable
                  onPress={() => update({ customFields: data.customFields.filter((_, j) => j !== i) })}
                  accessibilityRole="button"
                  accessibilityLabel="Remove custom field"
                  style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>×</Text>
                </Pressable>
              </View>
            ))}
            <WizardButton
              title={atLimit ? customFieldLimitMessage() : 'Add a custom field'}
              disabled={atLimit}
              onPress={() => update({ customFields: [...data.customFields, { label: '', value: '' }] })}
            />
          </>
        );
      }
      case 8: {
        const Row = ({ label, value, jumpTo }: { label: string; value: string; jumpTo: number }) => (
          <Pressable
            onPress={() => setStep(jumpTo)}
            accessibilityRole="button"
            style={{ borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>{label}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>{value || '—'}</Text>
          </Pressable>
        );
        return (
          <>
            <Text style={{ fontSize: 30, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' }}>Review</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', maxWidth: 300 }}>Tap anything to change it.</Text>
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
    <ScreenContainer scroll background={tint} style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 26, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>
          Step {step + 1} of {TOTAL_STEPS}
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: 8, paddingHorizontal: 14 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Close</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 99, backgroundColor: i <= step ? '#FFFFFF' : 'rgba(255,255,255,0.3)' }} />
        ))}
      </View>

      {renderStep()}
      {error && <ErrorText style={{ color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.25)', padding: spacing.sm, borderRadius: 12 }}>{error}</ErrorText>}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={step > 0 ? back : () => navigation.goBack()} accessibilityRole="button">
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>{step > 0 ? 'Back' : 'Cancel'}</Text>
        </Pressable>
        <Pressable
          onPress={step < TOTAL_STEPS - 1 ? next : handleSave}
          disabled={loading}
          accessibilityRole="button"
          style={{
            backgroundColor: '#FFFFFF', borderRadius: 999, minHeight: 56, paddingVertical: 16, paddingHorizontal: 26,
            flexDirection: 'row', alignItems: 'center', gap: 6, opacity: loading ? 0.7 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: tint }}>{step === TOTAL_STEPS - 1 ? 'Add pet' : 'Next'}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: tint }}>›</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
