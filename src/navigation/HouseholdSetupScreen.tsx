import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { createHousehold, joinHousehold } from '../household/householdService';
import { firestore } from '../firebase/config';

export function HouseholdSetupScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!user) return;
    setError(null);
    try {
      await createHousehold(firestore, user.uid, user.email ?? 'Owner', name);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleJoin = async () => {
    if (!user) return;
    setError(null);
    try {
      await joinHousehold(firestore, user.uid, user.email ?? 'Member', inviteCode);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Button title="Create a new household" onPress={() => setMode('create')} />
      <Button title="Join an existing household" onPress={() => setMode('join')} />
      {mode === 'create' ? (
        <>
          <TextInput placeholder="Household name" value={name} onChangeText={setName} />
          <Button title="Create" onPress={handleCreate} />
        </>
      ) : (
        <>
          <TextInput placeholder="Invite code" value={inviteCode} onChangeText={setInviteCode} />
          <Button title="Join" onPress={handleJoin} />
        </>
      )}
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}
