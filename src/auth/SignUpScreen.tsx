import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useAuth } from './AuthContext';

export function SignUpScreen({ navigation }: any) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      await signUp(email, password);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Sign Up" onPress={handleSubmit} />
      <Button title="Already have an account? Sign In" onPress={() => navigation.navigate('SignIn')} />
    </View>
  );
}
