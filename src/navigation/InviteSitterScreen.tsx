import React, { useEffect, useState } from 'react';
import { View, Pressable, Share } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { createSitterInvite } from '../sitters/sitterService';
import { firestore } from '../firebase/config';
import { petColor } from '../theme/petColors';
import { Pet } from '../types/pet';
import { DateField } from '../components/DateField';
import { ScreenContainer, Button, Title, BodyText, MutedText, ErrorText } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

export function InviteSitterScreen() {
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
  const [petIds, setPetIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  const togglePet = (petId: string) => {
    setPetIds((prev) => (prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]));
  };

  const handleGenerate = async () => {
    if (!household || petIds.length === 0 || expiresAt == null) return;
    setError(null);
    setLoading(true);
    try {
      const generated = await createSitterInvite(firestore, household.id, petIds, expiresAt);
      setCode(generated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (!code) return;
    Share.share({
      message: `You've been invited to sit for our pets on Pet Health Tracker! Use sitter code: ${code}`,
    });
  };

  if (code) {
    return (
      <ScreenContainer style={{ justifyContent: 'center', flexGrow: 1 }}>
        <Title>Sitter code generated</Title>
        <Title style={{ letterSpacing: 4 }}>{code}</Title>
        <MutedText>Share this with your sitter. It expires on {new Date(expiresAt!).toLocaleDateString()}.</MutedText>
        <Button title="Share sitter code" onPress={handleShare} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Title>Invite a sitter</Title>
      <BodyText style={{ fontWeight: '700' }}>Which pets?</BodyText>
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
      <DateField label="Access ends on" value={expiresAt} onChange={setExpiresAt} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button
        title="Generate sitter code"
        onPress={handleGenerate}
        disabled={petIds.length === 0 || expiresAt == null}
        loading={loading}
      />
    </ScreenContainer>
  );
}
