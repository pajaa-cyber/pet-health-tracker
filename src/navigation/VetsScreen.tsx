import React, { useEffect, useState } from 'react';
import { FlatList, View, Linking, Alert, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { subscribeToVets, deleteVet } from '../vets/vetService';
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

// No location permission needed here — the Google Maps app itself asks for
// (and uses) the device's current location once it opens this search, same
// as typing the query into Maps directly would.
function findNearestVet() {
  const url = 'https://www.google.com/maps/search/?api=1&query=emergency+veterinarian';
  Linking.openURL(url).catch(() =>
    Alert.alert('Could not open Maps', 'Check your connection and try again.')
  );
}

function callPhone(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() =>
    Alert.alert('Could not start a call', 'Check the phone number and try again.')
  );
}

function VetCard({ vet, pets, navigation, onDelete }: { vet: Vet; pets: Pet[]; navigation: any; onDelete: (vet: Vet) => void }) {
  const vetPets = pets.filter((p) => vet.petIds.includes(p.id));
  return (
    <Card style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 4 }}>
        <Subtitle style={{ flexShrink: 1, flexBasis: '60%' }}>{vet.clinicName}</Subtitle>
        {vet.isEmergency24h && (
          <View style={{ backgroundColor: colors.danger, borderRadius: radii.pill, paddingVertical: 2, paddingHorizontal: spacing.sm, flexShrink: 0 }}>
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
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title="Edit"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('EditVet', { vetId: vet.id })}
        />
        <Button
          title="Delete"
          variant="outline"
          borderColor={colors.danger}
          textColor={colors.danger}
          style={{ flex: 1 }}
          onPress={() => onDelete(vet)}
        />
      </View>
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

  const handleDelete = (vet: Vet) => {
    if (!household) return;
    Alert.alert('Delete this vet?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteVet(firestore, household.id, vet.id) },
    ]);
  };

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Title>Vets</Title>
      <Button
        title="🚨 Find nearest vet (emergency)"
        bg={colors.danger}
        textColor="#FFFFFF"
        onPress={findNearestVet}
      />
      <PetSelector pets={pets} />
      <Button title="Add a vet" onPress={() => navigation.navigate('AddVet')} />
      <FlatList
        style={{ flex: 1 }}
        data={filteredVets}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}
        renderItem={({ item }) => <VetCard vet={item} pets={pets} navigation={navigation} onDelete={handleDelete} />}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="🩺"
            title="No vets yet"
            message="Save every clinic you've used, with contact details and which pets go there."
          />
        }
      />
    </ScreenContainer>
  );
}
