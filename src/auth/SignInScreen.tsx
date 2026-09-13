import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { ScreenContainer, TextField, Button, ErrorText, Title, MutedText } from '../components/ui';
import { spacing } from '../theme/theme';

export function SignInScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll style={{ justifyContent: 'center', flexGrow: 1 }}>
      <Title style={{ marginBottom: spacing.sm }}>Welcome back</Title>
      <MutedText style={{ marginBottom: spacing.md }}>Sign in to your household</MutedText>
      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title="Sign In" onPress={handleSubmit} loading={loading} />
      <Button title="Need an account? Sign Up" variant="outline" onPress={() => navigation.navigate('SignUp')} />
    </ScreenContainer>
  );
}
