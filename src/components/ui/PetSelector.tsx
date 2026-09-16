import React from 'react';
import { ScrollView, Pressable, Image, View, Text } from 'react-native';
import { Pet } from '../../types/pet';
import { usePetSelection } from '../../selection/PetSelectionContext';
import { MutedText, Subtitle } from './Typography';
import { colors, spacing, text } from '../../theme/theme';
import { petColor } from '../../theme/petColors';
import { SPECIES_EMOJI } from '../../pets/species';

interface PetSelectorProps {
  pets: Pet[];
  variant?: 'light' | 'dark';
}

export function PetSelector({ pets, variant = 'light' }: PetSelectorProps) {
  const { selectedPetId, setSelectedPetId } = usePetSelection();
  const dark = variant === 'dark';
  const avatarSize = dark ? 54 : 48;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Dark variant bleeds to the screen edges per the design handoff — the
      // screen's own 18px horizontal padding is cancelled here and re-applied
      // as content padding instead, so the strip's first/last avatar still
      // lines up flush with the edge rather than the ScrollView's own bounds.
      style={dark ? { flexGrow: 0, marginHorizontal: -18 } : { flexGrow: 0 }}
      contentContainerStyle={{
        gap: dark ? 10 : spacing.sm,
        paddingVertical: spacing.xs,
        paddingHorizontal: dark ? 18 : 0,
      }}
    >
      <Pressable
        onPress={() => setSelectedPetId('all')}
        accessibilityRole="button"
        accessibilityLabel="All Pets"
        style={{ alignItems: 'center', gap: spacing.xs }}>
        <View
          style={{
            width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
            backgroundColor: dark
              ? (selectedPetId === 'all' ? colors.primary : 'rgba(255,255,255,0.08)')
              : colors.surfaceTint,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: selectedPetId === 'all' ? 3 : 0,
            borderColor: dark ? 'rgba(255,255,255,0.85)' : colors.primary,
          }}
        >
          <Subtitle style={dark ? { color: text.primary } : undefined}>🐾</Subtitle>
        </View>
        {dark ? (
          <Text
            numberOfLines={1}
            style={{ maxWidth: 62, fontSize: 11, fontWeight: '700', color: selectedPetId === 'all' ? text.primary : 'rgba(255,255,255,0.5)' }}
          >
            All Pets
          </Text>
        ) : (
          <MutedText>All Pets</MutedText>
        )}
      </Pressable>
      {pets.map((pet) => {
        const selected = selectedPetId === pet.id;
        return (
          <Pressable
            key={pet.id}
            onPress={() => setSelectedPetId(pet.id)}
            accessibilityRole="button"
            accessibilityLabel={pet.name}
            style={{ alignItems: 'center', gap: spacing.xs }}>
            <View
              style={{
                width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, overflow: 'hidden',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: dark
                  ? (selected ? petColor(pet) : 'rgba(255,255,255,0.08)')
                  : colors.surfaceTint,
                borderWidth: dark ? (selected ? 3 : 0) : 3,
                borderColor: dark ? 'rgba(255,255,255,0.85)' : (selected ? petColor(pet) : 'transparent'),
              }}
            >
              {pet.photoUrl ? (
                <Image source={{ uri: pet.photoUrl }} style={{ width: avatarSize, height: avatarSize }} resizeMode="cover" />
              ) : (
                <Subtitle style={dark ? { color: text.primary } : undefined}>{SPECIES_EMOJI[pet.species] ?? '🐾'}</Subtitle>
              )}
            </View>
            {dark ? (
              <Text
                numberOfLines={1}
                style={{ maxWidth: 62, fontSize: 11, fontWeight: '700', color: selected ? text.primary : 'rgba(255,255,255,0.5)' }}
              >
                {pet.name}
              </Text>
            ) : (
              <MutedText numberOfLines={1} style={{ maxWidth: 64 }}>{pet.name}</MutedText>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
