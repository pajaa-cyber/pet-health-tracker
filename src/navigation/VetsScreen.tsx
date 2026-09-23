import React, { useEffect, useState } from 'react';
import { FlatList, View, Linking, Alert, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { subscribeToVets } from '../vets/vetService';
import { firestore } from '../firebase/config';
import { usePetSelection } from '../selection/PetSelectionContext';
import { petColor } from '../theme/petColors';
import { Pet } from '../types/pet';
import { Vet } from '../types/vet';
import {
  ScreenContainer, Card, Button, Title, Subtitle, BodyText, MutedText, PetSelector, GuidedEmptyState,
} from '../components/ui';
import { spacing, radii, colors } from '../theme/theme';

function openMaps(address: string) {
  const url = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  Linking.openURL(url).catch(() =>
    Alert.alert('Could not open Maps', 'Check your connection and try again.')
  );
}

function callPhone(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() =>
    Alert.alert('Could not start a call', 'Check the phone number and try again.')
  );
}

function VetCard({ vet, pets, navigation }: { vet: Vet; pets: Pet[]; navigation: any }) {
  const vetPets = pets.filter((p) => vet.petIds.includes(p.id));
  return (
    <Card style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Subtitle>{vet.clinicName}</Subtitle>
        {vet.isEmergency24h && (
          <View style={{ backgroundColor: colors.danger, borderRadius: radii.pill, paddingVertical: 2, paddingHorizontal: spacing.sm }}>
            <MutedText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>24h emergency</MutedText>
          </View>
        )}
      </View>
      {vet.doctorName.length > 0 && <MutedText>{vet.doctorName}</MutedText>}
      {vet.speciality.length > 0 && <MutedText>{vet.speciality}</MutedText>}
      {vet.openingHours.length > 0 && <MutedText>{vet.openingHours}</MutedText>}
      {vet.address.length > 0 && (
        <Pressable onPress={() => openMaps(vet.address)} accessibilityRole="button" accessibilityLabel={`Open ${vet.address} in Maps`}>
          <BodyText style={{ color: colors.primary }}>📍 {vet.address}</BodyText>
        </Pressable>
      )}
      {vet.phone.length > 0 && (
        <Pressable onPress={() => callPhone(vet.phone)} accessibilityRole="button" accessibilityLabel={`Call ${vet.phone}`}>
          <BodyText style={{ color: colors.primary }}>📞 {vet.phone}</BodyText>
        </Pressable>
      )}
      {vet.notes.length > 0 && <MutedText>{vet.notes}</MutedText>}
      {vetPets.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {vetPets.map((pet) => (
            <View key={pet.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: petColor(pet) }} />
              <MutedText>{pet.name}</MutedText>
            </View>
          ))}
        </View>
      )}
      <Button title="Edit" variant="outline" onPress={() => navigation.navigate('EditVet', { vetId: vet.id })} />
    </Card>
  );
}

export function VetsScreen({ navigation }: any) {
  const { household } = useHousehold();
  const { selectedPetId } = usePetSelection();
  const [pets, setPets] = useState<Pet[]>([]);
  const [vets, setVets] = useState<Vet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    if (!household) return;
    return subscribeToVets(firestore, household.id, setVets);
  }, [household]);

  const filteredVets = vets.filter((v) => selectedPetId === 'all' || v.petIds.includes(selectedPetId));

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Title>Vets</Title>
      <PetSelector pets={pets} />
      <Button title="Add a vet" onPress={() => navigation.navigate('AddVet')} />
      <FlatList
        style={{ flex: 1 }}
        data={filteredVets}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}
        renderItem={({ item }) => <VetCard vet={item} pets={pets} navigation={navigation} />}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="🩺"
            title="No vets yet"
            message="Save every clinic you've used, with contact details and which pets go there."
            actionLabel="Add a vet"
            onAction={() => navigation.navigate('AddVet')}
          />
        }
      />
    </ScreenContainer>
  );
}
