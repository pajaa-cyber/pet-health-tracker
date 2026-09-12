// Placeholder — replaced in Task 15.
import React from 'react';
import { View, Text } from 'react-native';

export function PetHomeScreen({ route }: any) {
  return (
    <View style={{ padding: 24 }}>
      <Text>Pet home for {route.params?.petId} — record screens added in later tasks.</Text>
    </View>
  );
}
