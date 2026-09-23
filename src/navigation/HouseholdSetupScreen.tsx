import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { createHousehold, joinHousehold } from '../household/householdService';
import { redeemSitterInvite } from '../sitters/sitterService';
import { firestore } from '../firebase/config';
import { ScreenContainer, TextField, Button, ErrorText, Title, MutedText, Chip } from '../components/ui';
import { spacing } from '../theme/theme';

export function HouseholdSetupScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'create' | 'join' | 'sitter'>('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [sitterCode, setSitterCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      await createHousehold(firestore, user.uid, user.email ?? 'Owner', name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      await joinHousehold(firestore, user.uid, user.email ?? 'Member', inviteCode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemSitterCode = async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      await redeemSitterInvite(firestore, user.uid, sitterCode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll style={{ justifyContent: 'center', flexGrow: 1 }}>
      <Title style={{ marginBottom: spacing.sm }}>Set up your household</Title>
      <MutedText style={{ marginBottom: spacing.md }}>
        Create a new household for your pets, join one with an invite code, or redeem a sitter code.
      </MutedText>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <Chip label="Create new" selected={mode === 'create'} onPress={() => setMode('create')} />
        <Chip label="Join existing" selected={mode === 'join'} onPress={() => setMode('join')} />
        <Chip label="I'm a sitter" selected={mode === 'sitter'} onPress={() => setMode('sitter')} />
      </View>
      {mode === 'create' ? (
        <>
          <TextField label="Household name" placeholder="e.g. The Smith Family" value={name} onChangeText={setName} />
          <Button title="Create household" onPress={handleCreate} loading={loading} />
        </>
      ) : mode === 'join' ? (
        <>
          <TextField
            label="Invite code"
            placeholder="6-character code"
            autoCapitalize="characters"
            value={inviteCode}
            onChangeText={setInviteCode}
          />
          <Button title="Join household" onPress={handleJoin} loading={loading} />
        </>
      ) : (
        <>
          <TextField
            label="Sitter code"
            placeholder="8-character code"
            autoCapitalize="characters"
            value={sitterCode}
            onChangeText={setSitterCode}
          />
          <Button title="Redeem sitter code" onPress={handleRedeemSitterCode} loading={loading} />
        </>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </ScreenContainer>
  );
}
