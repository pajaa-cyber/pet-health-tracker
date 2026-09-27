import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { ScreenContainer, Title, MutedText, Button, RecordListHeader } from '../components/ui';
import { spacing, shell } from '../theme/theme';

export function SettingsScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const { household } = useHousehold();
  const [signingOut, setSigningOut] = useState(false);

  const confirmSignOut = () => {
    Alert.alert('Sign out?', "You'll need to sign back in to see your pets again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer background={shell.bg} style={{ padding: 0 }}>
      <RecordListHeader title="Settings" subtitle={user?.email ?? ''} onBack={() => navigation.goBack()} />
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        {household && (
          <View style={{ borderRadius: 18, backgroundColor: shell.card, padding: 16, gap: 2 }}>
            <MutedText>Household</MutedText>
            <Title style={{ fontSize: 18 }}>{household.name.trim()}</Title>
          </View>
        )}
        <Button title="Reminder settings" variant="outline" onPress={() => navigation.navigate('ReminderSettings')} />
        <Button title="Sign out" variant="outline" onPress={confirmSignOut} loading={signingOut} />
      </View>
    </ScreenContainer>
  );
}
