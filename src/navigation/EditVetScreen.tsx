import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { subscribeToVets, updateVet } from '../vets/vetService';
import { firestore } from '../firebase/config';
import { petColor } from '../theme/petColors';
import { Pet } from '../types/pet';
import { ScreenContainer, TextField, Button, Chip, BodyText, MutedText, ErrorText } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

export function EditVetScreen({ route, navigation }: any) {
  const { vetId } = route.params;
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [isEmergency24h, setIsEmergency24h] = useState(false);
  const [notes, setNotes] = useState('');
  const [petIds, setPetIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Seeds the form once from the first snapshot that contains the vet, then
  // never again — same reasoning as EditEventScreen (Plan 6): without this,
  // any later snapshot while the form is open (another member's write, a
  // slow-network double delivery) would silently clobber whatever the user
  // has typed.
  const loadedVetRef = useRef(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVets(firestore, household.id, (vets) => {
      if (loadedVetRef.current) return;
      const vet = vets.find((v) => v.id === vetId);
      if (!vet) {
        if (vets.length > 0) setNotFound(true);
        return;
      }
      setClinicName(vet.clinicName);
      setDoctorName(vet.doctorName);
      setAddress(vet.address);
      setPhone(vet.phone);
      setOpeningHours(vet.openingHours);
      setSpeciality(vet.speciality);
      setIsEmergency24h(vet.isEmergency24h);
      setNotes(vet.notes);
      setPetIds(vet.petIds);
      setLoaded(true);
      loadedVetRef.current = true;
    });
  }, [household, vetId]);

  const togglePet = (petId: string) => {
    setPetIds((prev) => (prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]));
  };

  const handleSave = async () => {
    if (!household) return;
    setError(null);
    setSaving(true);
    try {
      await updateVet(firestore, household.id, vetId, {
        clinicName, doctorName, address, phone, openingHours,
        speciality, isEmergency24h, notes, petIds,
      });
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
        <ErrorText>Vet not found.</ErrorText>
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
      <TextField label="Clinic name" value={clinicName} onChangeText={setClinicName} />
      <TextField label="Doctor name" placeholder="Optional" value={doctorName} onChangeText={setDoctorName} />
      <TextField label="Address" placeholder="Optional" value={address} onChangeText={setAddress} />
      <TextField label="Phone" placeholder="Optional" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Opening hours" placeholder="e.g. Mon-Fri 9am-6pm" value={openingHours} onChangeText={setOpeningHours} />
      <TextField label="Speciality" placeholder="Optional, e.g. Exotic pets" value={speciality} onChangeText={setSpeciality} />
      <Chip label="24-hour emergency clinic" selected={isEmergency24h} onPress={() => setIsEmergency24h((v) => !v)} />
      <TextField
        label="Notes" placeholder="Optional" value={notes} onChangeText={setNotes}
        multiline style={{ minHeight: 96, textAlignVertical: 'top' }}
      />

      <BodyText style={{ fontWeight: '700' }}>Which pets go there?</BodyText>
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

      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Save" onPress={handleSave} loading={saving} disabled={clinicName.trim().length === 0} />
    </ScreenContainer>
  );
}
