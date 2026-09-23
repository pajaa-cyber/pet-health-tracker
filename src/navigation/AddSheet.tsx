import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View, FlatList, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePetSelection } from '../selection/PetSelectionContext';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { spacing, shell, text } from '../theme/theme';

interface AddAction {
  label: string;
  emoji: string;
  color: string;
  route: string;
  needsPet: boolean;
  topLevel?: boolean;
}

const ADD_ACTIONS: AddAction[] = [
  { label: 'Add a Pet', emoji: '🐾', color: '#7C3AED', route: 'AddPet', needsPet: false },
  { label: 'Add a Vaccine', emoji: '💉', color: '#EF4444', route: 'AddVaccine', needsPet: true },
  { label: 'Add a Medication', emoji: '💊', color: '#3B82F6', route: 'AddMedication', needsPet: true },
  { label: 'Log a Weight', emoji: '⚖️', color: '#84CC16', route: 'WeightLog', needsPet: true },
  { label: 'Add a Vet Visit', emoji: '🩺', color: '#14B8A6', route: 'AddVetVisit', needsPet: true },
  { label: 'Add an Expense', emoji: '💰', color: '#F97316', route: 'AddExpense', needsPet: true },
  { label: 'Add a Vet', emoji: '🏥', color: '#6366F1', route: 'AddVet', needsPet: false, topLevel: true },
  { label: 'Add a Document', emoji: '📄', color: '#06B6D4', route: 'AddDocument', needsPet: true },
  { label: 'Add to Calendar', emoji: '📅', color: '#EC4899', route: 'AddEvent', needsPet: false, topLevel: true },
  { label: 'Invite a Sitter', emoji: '🐕‍🦺', color: '#EAB308', route: 'InviteSitter', needsPet: false, topLevel: true },
];

export function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const navigation = useNavigation<any>();
  const { selectedPetId } = usePetSelection();
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  const selectedPet = selectedPetId === 'all' ? null : pets.find((p) => p.id === selectedPetId) ?? null;

  const handlePress = (action: AddAction) => {
    onClose();
    if (action.topLevel) {
      navigation.navigate(action.route);
      return;
    }
    if (!action.needsPet) {
      navigation.navigate('PetsTab', { screen: action.route });
      return;
    }
    if (selectedPetId !== 'all') {
      navigation.navigate('PetsTab', { screen: action.route, params: { petId: selectedPetId } });
      return;
    }
    navigation.navigate('PetsTab', { screen: 'ChoosePetForAdd', params: { targetRoute: action.route } });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: shell.scrim, justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          style={{
            backgroundColor: shell.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14, gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: text.primary }}>What are we adding?</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: shell.control, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 16, color: text.primary, fontWeight: '700' }}>×</Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
            {selectedPet ? `Adding to ${selectedPet.name}.` : 'No pet selected — we will ask which one.'}
          </Text>
          <FlatList
            data={ADD_ACTIONS}
            numColumns={2}
            keyExtractor={(a) => a.route}
            scrollEnabled={false}
            columnWrapperStyle={{ gap: 10 }}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handlePress(item)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={{
                  flex: 1, minHeight: 88, borderRadius: 18, padding: 13, justifyContent: 'flex-end',
                  backgroundColor: item.color + '26', // ~15% alpha tint, consistent with the section-tile treatment (Task 6)
                }}
              >
                <Text style={{ fontSize: 21, marginBottom: 6 }}>{item.emoji}</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', lineHeight: 17, color: text.primary }}>{item.label}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
