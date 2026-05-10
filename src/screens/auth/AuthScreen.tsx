import React, {useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';

import {AppText} from '../../components/ui/AppText';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {Screen} from '../../components/ui/Screen';
import {SegmentedControl} from '../../components/ui/SegmentedControl';
import {TextField} from '../../components/ui/TextField';
import {useAuth} from '../../context/AuthContext';
import {spacing} from '../../theme/theme';
import {email as validateEmail, minLength} from '../../utils/validation';

type AuthMode = 'signin' | 'signup';

export function AuthScreen() {
  const {signIn, signUp} = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{email?: string; password?: string}>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const nextErrors = {
      email: validateEmail(email),
      password: minLength(password, 'Password', 6),
    };

    setErrors(nextErrors);
    return !nextErrors.email && !nextErrors.password;
  };

  const submit = async () => {
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        const message = await signUp(email.trim(), password);
        if (message) {
          Alert.alert('Confirm email', message);
          setMode('signin');
        }
      }
    } catch (error) {
      Alert.alert('Auth error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <AppText variant="label" muted>
          Private futsal club
        </AppText>
        <AppText variant="title">Scoreboard</AppText>
        <AppText muted>
          Matches, votes, highlights, and bragging rights for the monthly game.
        </AppText>
      </View>

      <Card style={styles.card}>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            {label: 'Sign in', value: 'signin'},
            {label: 'Sign up', value: 'signup'},
          ]}
        />
        <TextField
          autoCapitalize="none"
          error={errors.email}
          keyboardType="email-address"
          label="Email"
          onChangeText={value => {
            setEmail(value);
            setErrors(current => ({...current, email: undefined}));
          }}
          placeholder="you@example.com"
          value={email}
        />
        <TextField
          error={errors.password}
          label="Password"
          onChangeText={value => {
            setPassword(value);
            setErrors(current => ({...current, password: undefined}));
          }}
          placeholder="Minimum 6 characters"
          secureTextEntry
          value={password}
        />
        <Button
          label={mode === 'signin' ? 'Sign in' : 'Create account'}
          loading={loading}
          onPress={submit}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  card: {
    gap: spacing.lg,
  },
});
