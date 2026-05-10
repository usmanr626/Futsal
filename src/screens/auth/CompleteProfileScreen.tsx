import React, {useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';

import {AvatarPicker} from '../../components/profile/AvatarPicker';
import {AppText} from '../../components/ui/AppText';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {Screen} from '../../components/ui/Screen';
import {TextField} from '../../components/ui/TextField';
import {useAuth} from '../../context/AuthContext';
import {spacing} from '../../theme/theme';
import {maxLength, required, username as validateUsername} from '../../utils/validation';

type ProfileErrors = {
  username?: string;
  firstName?: string;
  lastName?: string;
  favoritePosition?: string;
};

export function CompleteProfileScreen() {
  const {profile, isAdmin, updateProfile} = useAuth();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [favoritePosition, setFavoritePosition] = useState(
    profile?.favorite_position ?? '',
  );
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const nextErrors: ProfileErrors = {
      username: validateUsername(username),
      firstName: required(firstName, 'First name'),
      lastName: maxLength(lastName, 'Last name', 50),
      favoritePosition: maxLength(favoritePosition, 'Favorite position', 30),
    };

    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const save = async () => {
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      await updateProfile({
        username: username.trim(),
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        favorite_position: favoritePosition.trim() || null,
      });
    } catch (error) {
      Alert.alert(
        'Profile error',
        error instanceof Error ? error.message : 'Could not save profile.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <AppText variant="title">Complete profile</AppText>
        <AppText muted>
          Pick the name your friends will see on matches and leaderboards.
        </AppText>
      </View>

      <Card style={styles.card}>
        <AvatarPicker
          isAdmin={isAdmin}
          profile={profile}
          onAvatarPathChange={path => updateProfile({avatar_path: path})}
        />
        <TextField
          autoCapitalize="none"
          error={errors.username}
          label="Username"
          onChangeText={value => {
            setUsername(value);
            setErrors(current => ({...current, username: undefined}));
          }}
          placeholder="Username"
          value={username}
        />
        <TextField
          error={errors.firstName}
          label="First name"
          onChangeText={value => {
            setFirstName(value);
            setErrors(current => ({...current, firstName: undefined}));
          }}
          placeholder="First name"
          value={firstName}
        />
        <TextField
          error={errors.lastName}
          label="Last name"
          onChangeText={value => {
            setLastName(value);
            setErrors(current => ({...current, lastName: undefined}));
          }}
          placeholder="Last name"
          value={lastName}
        />
        <TextField
          error={errors.favoritePosition}
          label="Favorite position"
          onChangeText={value => {
            setFavoritePosition(value);
            setErrors(current => ({...current, favoritePosition: undefined}));
          }}
          placeholder="Pivot, winger, keeper..."
          value={favoritePosition}
        />
        <Button label="Save profile" loading={loading} onPress={save} />
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
