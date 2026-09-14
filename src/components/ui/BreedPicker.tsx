import React, { useState } from 'react';
import { Modal, View, FlatList, Pressable } from 'react-native';
import { PetSpecies } from '../../types/pet';
import { BREEDS_BY_SPECIES } from '../../pets/breeds';
import { BodyText, Title, MutedText } from './Typography';
import { TextField } from './TextField';
import { Button } from './Button';
import { colors, spacing, radii } from '../../theme/theme';

const PINNED = ['Mixed', 'Stray or rescued', "Don't know"];

interface BreedPickerProps {
  visible: boolean;
  species: PetSpecies;
  value: string;
  onSelect: (breed: string) => void;
  onClose: () => void;
}

export function BreedPicker({ visible, species, value, onSelect, onClose }: BreedPickerProps) {
  const [customText, setCustomText] = useState(PINNED.includes(value) ? '' : value);
  const list = BREEDS_BY_SPECIES[species] ?? [];

  const choose = (breed: string) => {
    onSelect(breed);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md }}>
        <Title>Breed</Title>
        <View style={{ gap: spacing.xs }}>
          {PINNED.map((label) => (
            <Pressable
              key={label}
              onPress={() => choose(label)}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={{
                minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md,
                borderRadius: radii.md, backgroundColor: value === label ? colors.primary : colors.surfaceTint,
              }}
            >
              <BodyText style={{ color: value === label ? '#FFFFFF' : colors.text, fontWeight: '600' }}>{label}</BodyText>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <FlatList
          data={list}
          keyExtractor={(b) => b}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: spacing.xs }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityLabel={item}
              style={{
                minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md,
                borderRadius: radii.md, backgroundColor: value === item ? colors.primary : 'transparent',
              }}
            >
              <BodyText style={{ color: value === item ? '#FFFFFF' : colors.text }}>{item}</BodyText>
            </Pressable>
          )}
          ListEmptyComponent={<MutedText>No preset list for this species — type your own below.</MutedText>}
        />
        <View style={{ gap: spacing.xs }}>
          <TextField
            label="Not listed? Type your own"
            placeholder="Breed name"
            value={customText}
            onChangeText={setCustomText}
          />
          <Button title="Use this breed" variant="outline" onPress={() => customText.trim() && choose(customText.trim())} />
        </View>
        <Button title="Cancel" variant="outline" onPress={onClose} />
      </View>
    </Modal>
  );
}
