import React, { useEffect, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { subscribeToMySitterGrants } from '../sitters/sitterService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { SitterAccessGrant } from '../types/sitterAccess';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { SPECIES_EMOJI, speciesDisplay } from '../pets/species';
import { ScreenContainer, Title, Subtitle, MutedText, Card } from '../components/ui';
import { spacing } from '../theme/theme';

// A grant plus the resolved Pet objects it covers, from that grant's own
// household — one entry per household that has ever granted this sitter
// access, since subscribeToMySitterGrants can return grants from more than
// one household at once.
interface GrantedHousehold {
  grant: SitterAccessGrant;
  pets: Pet[];
}

export function SitterViewScreen() {
  const { user } = useAuth();
  const [grants, setGrants] = useState<SitterAccessGrant[]>([]);
  const [granted, setGranted] = useState<GrantedHousehold[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToMySitterGrants(firestore, user.uid, setGrants);
  }, [user]);

  useEffect(() => {
    const activeGrants = grants.filter((g) => !g.revoked && g.expiresAt > Date.now());
    const unsubs = activeGrants.map((grant) =>
      subscribeToPets(firestore, grant.householdId, (allPets) => {
        setGranted((prev) => {
          const withoutThis = prev.filter((g) => g.grant.householdId !== grant.householdId);
          const grantedPets = allPets.filter((p) => grant.petIds.includes(p.id));
          return [...withoutThis, { grant, pets: grantedPets }];
        });
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [grants]);

  const allPets = granted.flatMap((g) => g.pets);

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Title>Pets you're sitting for</Title>
      <MutedText>Read-only access, granted by the pet's household.</MutedText>
      <FlatList
        data={allPets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: petColor(item) }} />
            <View>
              <Subtitle>{SPECIES_EMOJI[item.species] ?? '🐾'} {item.name}</Subtitle>
              <MutedText>{speciesDisplay(item)}{item.breed ? ` · ${item.breed}` : ''}</MutedText>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text style={{ padding: spacing.md }}>No active sitter access right now.</Text>}
      />
    </ScreenContainer>
  );
}
