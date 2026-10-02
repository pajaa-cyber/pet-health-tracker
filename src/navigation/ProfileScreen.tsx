import React from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { ScreenContainer, RecordListHeader } from '../components/ui';
import { shell, text, spacing, radii } from '../theme/theme';

export function ProfileScreen({ navigation }: any) {
  const { user } = useAuth();
  const { household } = useHousehold();
  const member = household?.members.find((m) => m.userId === user?.uid);

  return (
    <ScreenContainer noPadding background={shell.bg}>
      <RecordListHeader title="Profile" onBack={() => navigation.goBack()} />
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <View style={{ borderRadius: radii.lg, backgroundColor: shell.card, padding: 16, gap: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>Email</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: text.primary }}>{user?.email ?? '—'}</Text>
        </View>
        <View style={{ borderRadius: radii.lg, backgroundColor: shell.card, padding: 16, gap: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>Name in this household</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: text.primary }}>{member?.displayName ?? '—'}</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
