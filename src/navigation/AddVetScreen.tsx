import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { createVet } from '../vets/vetService';
import { firestore } from '../firebase/config';
import { petColor } from '../theme/petColors';
import { Pet } from '../types/pet';
import { ScreenContainer, TextField, Button, Chip, Title, BodyText, MutedText, ErrorText } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

export function AddVetScreen({ navigation }: any) {
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  const togglePet = (petId: string) => {
    setPetIds((prev) => (prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]));
  };

  const handleSubmit = async () => {
    if (!household) return;
    setError(null);
    setLoading(true);
    try {
      await createVet(firestore, household.id, {
        clinicName, doctorName, address, phone, openingHours,
        speciality, isEmergency24h, notes, petIds,
      });
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <Title>Add a vet</Title>
      <TextField label="Clinic name" placeholder="e.g. Riverside Vet Clinic" value={clinicName} onChangeText={setClinicName} />
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
      <MutedText>Optional — you can leave this for later.</MutedText>
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
      <Button title="Add vet" onPress={handleSubmit} disabled={clinicName.trim().length === 0} loading={loading} />
    </ScreenContainer>
  );
}
