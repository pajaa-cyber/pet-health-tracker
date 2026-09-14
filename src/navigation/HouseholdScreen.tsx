import React from 'react';
import { FlatList } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { ScreenContainer, Card, Title, Subtitle, MutedText, Button } from '../components/ui';
import { spacing } from '../theme/theme';

export function HouseholdScreen({ navigation }: any) {
  const { household } = useHousehold();

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Title>{household?.name ?? 'Household'}</Title>
      <MutedText>{household?.members.length ?? 0} member{household?.members.length === 1 ? '' : 's'}</MutedText>
      <FlatList
        data={household?.members ?? []}
        keyExtractor={(m) => m.userId}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Card>
            <Subtitle>{item.displayName}</Subtitle>
          </Card>
        )}
      />
      {__DEV__ && (
        <Button
          variant="outline"
          title="Developer: style guide"
          onPress={() => navigation.navigate('PetsTab', { screen: 'DevStyleGuide' })}
        />
      )}
    </ScreenContainer>
  );
}
