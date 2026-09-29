import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { createHousehold, joinHousehold } from '../household/householdService';
import { redeemSitterInvite } from '../sitters/sitterService';
import { firestore } from '../firebase/config';
import { ScreenContainer, TextField, Button, ErrorText, Title, MutedText, Chip } from '../components/ui';
import { spacing } from '../theme/theme';

export function HouseholdSetupScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'create' | 'join' | 'sitter'>('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [sitterCode, setSitterCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Button's `disabled` prop only takes effect on the next render, which
  // isn't synchronous with this handler firing — a fast double-tap can call
  // handleCreate/handleJoin a second time before that first re-render lands,
  // firing a redundant request that fails (the user is already a member by
  // then) with a raw [firestore/permission-denied] string, even though the
  // first request already succeeded. A ref-guard checked at the very top of
  // each handler closes that race regardless of render timing.
  const submittingRef = useRef(false);

  const handleCreate = async () => {
    if (!user || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      await createHousehold(firestore, user.uid, user.email ?? 'Owner', name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      await joinHousehold(firestore, user.uid, user.email ?? 'Member', inviteCode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleRedeemSitterCode = async () => {
    if (!user || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      await redeemSitterInvite(firestore, user.uid, sitterCode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll style={{ paddingTop: insets.top + spacing.sm }}>
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
