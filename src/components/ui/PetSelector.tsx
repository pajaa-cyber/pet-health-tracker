import React from 'react';
import { ScrollView, Pressable, Image, View } from 'react-native';
import { Pet } from '../../types/pet';
import { usePetSelection } from '../../selection/PetSelectionContext';
import { MutedText, Subtitle } from './Typography';
import { colors, spacing } from '../../theme/theme';

const SPECIES_EMOJI: Record<string, string> = { dog: '🐶', cat: '🐱', other: '🐾' };

export function PetSelector({ pets }: { pets: Pet[] }) {
  const { selectedPetId, setSelectedPetId } = usePetSelection();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
      <Pressable onPress={() => setSelectedPetId('all')} style={{ alignItems: 'center', gap: spacing.xs }}>
        <View
          style={{
            width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceTint,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: selectedPetId === 'all' ? 3 : 0, borderColor: colors.primary,
          }}
        >
          <Subtitle>🐾</Subtitle>
        </View>
        <MutedText>All Pets</MutedText>
      </Pressable>
      {pets.map((pet) => (
        <Pressable key={pet.id} onPress={() => setSelectedPetId(pet.id)} style={{ alignItems: 'center', gap: spacing.xs }}>
          <View
            style={{
              width: 48, height: 48, borderRadius: 24, overflow: 'hidden',
              alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTint,
              borderWidth: 3, borderColor: selectedPetId === pet.id ? pet.colorKey : 'transparent',
            }}
          >
            {pet.photoUrl ? (
              <Image source={{ uri: pet.photoUrl }} style={{ width: 48, height: 48 }} resizeMode="cover" />
            ) : (
              <Subtitle>{SPECIES_EMOJI[pet.species] ?? '🐾'}</Subtitle>
            )}
          </View>
          <MutedText numberOfLines={1} style={{ maxWidth: 64 }}>{pet.name}</MutedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}
