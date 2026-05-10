import {RouteProp, useFocusEffect, useRoute} from '@react-navigation/native';
import React, {useCallback, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';

import {ProfileAvatar} from '../../components/profile/ProfileAvatar';
import {AppText} from '../../components/ui/AppText';
import {Card} from '../../components/ui/Card';
import {EmptyState} from '../../components/ui/EmptyState';
import {Screen} from '../../components/ui/Screen';
import {fetchProfileById} from '../../services/profileService';
import {spacing} from '../../theme/theme';
import type {Profile} from '../../types/domain';
import type {RootStackParamList} from '../../types/navigation';
import {playerName} from '../../utils/player';

type Route = RouteProp<RootStackParamList, 'UserProfile'>;

export function UserProfileScreen() {
  const route = useRoute<Route>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setProfile(await fetchProfileById(route.params.userId));
    } catch (error) {
      Alert.alert('Load error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, [route.params.userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!profile) {
    return (
      <Screen>
        <EmptyState title={loading ? 'Loading player' : 'Player not found'} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ProfileAvatar profile={profile} size={96} />
        <View style={styles.headerText}>
          <AppText variant="title">{playerName(profile)}</AppText>
          <AppText muted>@{profile.username}</AppText>
        </View>
      </View>

      <Card style={styles.card}>
        <View style={styles.row}>
          <AppText variant="label" muted>
            Role
          </AppText>
          <AppText>{profile.is_active ? 'Player' : 'Inactive player'}</AppText>
        </View>
        <View style={styles.row}>
          <AppText variant="label" muted>
            Favorite position
          </AppText>
          <AppText>{profile.favorite_position || 'Not set'}</AppText>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  headerText: {
    flex: 1,
  },
  card: {
    gap: spacing.lg,
  },
  row: {
    gap: spacing.xs,
  },
});
