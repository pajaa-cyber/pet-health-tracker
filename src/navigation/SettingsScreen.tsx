import React, { useState } from 'react';
import { View, Text, Pressable, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { ScreenContainer, RecordListHeader } from '../components/ui';
import { shell, text, colors, spacing, radii } from '../theme/theme';

function SettingsRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: 14, paddingHorizontal: 16,
      }}
    >
      <Ionicons name={icon as any} size={20} color={text.secondary} />
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: text.primary }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={text.secondary} />
    </Pressable>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: text.secondary, paddingHorizontal: 4 }}>
        {title}
      </Text>
      <View style={{ borderRadius: radii.lg, backgroundColor: shell.card, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: shell.control, marginLeft: 16 + 20 + 12 }} />;
}

export function SettingsScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const { household } = useHousehold();
  const [signingOut, setSigningOut] = useState(false);

  const confirmSignOut = () => {
    Alert.alert('Log out?', "You'll need to sign back in to see your pets again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
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

  const shareApp = () => {
    Share.share({
      message: 'I track our pets\' health, vaccines and vet visits with Pet Health Tracker — check it out!',
    });
  };

  return (
    <ScreenContainer noPadding background={shell.bg}>
      <RecordListHeader title="Settings" subtitle={user?.email ?? ''} onBack={() => navigation.goBack()} />
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <SettingsSection title="My settings">
          <SettingsRow icon="person-outline" label="Profile" onPress={() => navigation.navigate('Profile')} />
          <Divider />
          <SettingsRow icon="options-outline" label="Preferences" onPress={() => navigation.navigate('Preferences')} />
          <Divider />
          <SettingsRow icon="notifications-outline" label="Notifications" onPress={() => navigation.navigate('ReminderSettings')} />
        </SettingsSection>

        {household && (
          <SettingsSection title="Household">
            <SettingsRow
              icon="paw-outline"
              label="Pets"
              onPress={() => navigation.navigate('Main', { screen: 'PetsTab', params: { screen: 'PetList' } })}
            />
            <Divider />
            <SettingsRow icon="people-outline" label="Users" onPress={() => navigation.navigate('Main', { screen: 'HouseholdTab' })} />
          </SettingsSection>
        )}

        <SettingsSection title="Support">
          <SettingsRow icon="share-social-outline" label="Share this app" onPress={shareApp} />
          <Divider />
          <SettingsRow icon="diamond-outline" label="Subscriptions" onPress={() => navigation.navigate('Subscriptions')} />
        </SettingsSection>

        <Pressable
          onPress={confirmSignOut}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
            borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.danger,
            paddingVertical: 14, marginTop: spacing.xs,
          }}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.danger }}>
            {signingOut ? 'Logging out…' : 'Log out'}
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
