import {BellRing, UserPlus} from 'lucide-react-native';
import React, {useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';

import {AvatarPicker} from '../../components/profile/AvatarPicker';
import {AppText} from '../../components/ui/AppText';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {Screen} from '../../components/ui/Screen';
import {TextField} from '../../components/ui/TextField';
import {useAuth} from '../../context/AuthContext';
import {sendAdminBroadcastNotification} from '../../services/notificationService';
import {colors, spacing} from '../../theme/theme';
import {playerName} from '../../utils/player';
import {maxLength, required, username as validateUsername} from '../../utils/validation';

type ProfileErrors = {
  username?: string;
  firstName?: string;
  lastName?: string;
  favoritePosition?: string;
};

export function ProfileScreen() {
  const {
    profile,
    isAdmin,
    hasAnyAdmin,
    updateProfile,
    claimFirstAdmin,
    signOut,
  } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [favoritePosition, setFavoritePosition] = useState(
    profile?.favorite_position ?? '',
  );
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastError, setBroadcastError] = useState<string | undefined>();
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
      Alert.alert('Saved', 'Profile updated.');
    } catch (error) {
      Alert.alert('Profile error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  const claimAdmin = async () => {
    try {
      setLoading(true);
      await claimFirstAdmin();
      Alert.alert('Admin enabled', 'You are now the first admin.');
    } catch (error) {
      Alert.alert('Admin error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendBroadcast = async () => {
    const message = broadcastMessage.trim();
    if (!message) {
      setBroadcastError('Message is required');
      return;
    }

    if (message.length > 140) {
      setBroadcastError('Keep it under 140 characters');
      return;
    }

    try {
      setLoading(true);
      await sendAdminBroadcastNotification(message);
      setBroadcastMessage('');
      setBroadcastError(undefined);
      Alert.alert('Sent', 'Notification sent to the squad.');
    } catch (error) {
      Alert.alert(
        'Push error',
        error instanceof Error ? error.message : 'Could not send notification.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AvatarPicker
          isAdmin={isAdmin}
          profile={profile}
          onAvatarPathChange={path => updateProfile({avatar_path: path})}
        />
        <View style={styles.headerText}>
          <AppText variant="title">{playerName(profile)}</AppText>
          <AppText muted>{isAdmin ? 'Admin' : 'Player'}</AppText>
        </View>
      </View>

      {!hasAnyAdmin ? (
        <Card style={styles.card}>
          <AppText variant="heading">Claim first admin</AppText>
          <AppText muted>
            This is only available before any admin exists. After that, admins grant
            access to other players.
          </AppText>
          <Button
            label="Claim admin"
            icon={<UserPlus color={colors.white} size={17} />}
            loading={loading}
            onPress={claimAdmin}
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <TextField
          autoCapitalize="none"
          error={errors.username}
          label="Username"
          onChangeText={value => {
            setUsername(value);
            setErrors(current => ({...current, username: undefined}));
          }}
          value={username}
        />
        <TextField
          error={errors.firstName}
          label="First name"
          onChangeText={value => {
            setFirstName(value);
            setErrors(current => ({...current, firstName: undefined}));
          }}
          value={firstName}
        />
        <TextField
          error={errors.lastName}
          label="Last name"
          onChangeText={value => {
            setLastName(value);
            setErrors(current => ({...current, lastName: undefined}));
          }}
          value={lastName}
        />
        <TextField
          error={errors.favoritePosition}
          label="Favorite position"
          onChangeText={value => {
            setFavoritePosition(value);
            setErrors(current => ({...current, favoritePosition: undefined}));
          }}
          value={favoritePosition}
        />
        <Button label="Save profile" loading={loading} onPress={save} />
      </Card>

      {isAdmin ? (
        <Card style={styles.card}>
          <AppText variant="heading">Push notifications</AppText>
          <AppText muted>Send a short update to everyone with notifications enabled.</AppText>
          <TextField
            error={broadcastError}
            label="Message"
            maxLength={140}
            multiline
            onChangeText={value => {
              setBroadcastMessage(value);
              setBroadcastError(undefined);
            }}
            placeholder="Match moved to 9 PM"
            style={styles.broadcastInput}
            value={broadcastMessage}
          />
          <Button
            label="Send notification"
            icon={<BellRing color={colors.text} size={17} />}
            loading={loading}
            onPress={sendBroadcast}
            variant="secondary"
          />
        </Card>
      ) : null}

      <Button label="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerText: {
    flex: 1,
  },
  card: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  broadcastInput: {
    minHeight: 88,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
});
