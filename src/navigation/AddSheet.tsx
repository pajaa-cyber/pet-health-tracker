import React from 'react';
import { Modal, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePetSelection } from '../selection/PetSelectionContext';
import { BodyText, Title } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

const ADD_ACTIONS: { label: string; route: string; needsPet: boolean }[] = [
  { label: 'Add a Pet', route: 'AddPet', needsPet: false },
  { label: 'Add a Vaccine', route: 'AddVaccine', needsPet: true },
  { label: 'Add a Medication', route: 'AddMedication', needsPet: true },
  { label: 'Log a Weight', route: 'WeightLog', needsPet: true },
  { label: 'Add a Vet Visit', route: 'AddVetVisit', needsPet: true },
  { label: 'Add an Expense', route: 'AddExpense', needsPet: true },
];

export function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const navigation = useNavigation<any>();
  const { selectedPetId } = usePetSelection();

  const handlePress = (action: (typeof ADD_ACTIONS)[number]) => {
    onClose();
    // Push onto the Pets tab's nested stack (named "PetsTab" in MainTabs)
    // regardless of which tab is currently focused, so the target screen's
    // existing header/back behavior works unchanged.
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
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, gap: spacing.sm }}>
          <Title style={{ marginBottom: spacing.sm }}>Add</Title>
          {ADD_ACTIONS.map((action) => (
            <Pressable
              key={action.route}
              onPress={() => handlePress(action)}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={{ paddingVertical: spacing.sm }}>
              <BodyText>{action.label}</BodyText>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
