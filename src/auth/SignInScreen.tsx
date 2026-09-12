import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useAuth } from './AuthContext';

export function SignInScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      await signIn(email, password);
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
      <Button title="Sign In" onPress={handleSubmit} />
      <Button title="Need an account? Sign Up" onPress={() => navigation.navigate('SignUp')} />
    </View>
  );
}
