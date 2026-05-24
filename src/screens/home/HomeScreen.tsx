import {
  useFocusEffect,
  useNavigation,
  type CompositeNavigationProp,
} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {CalendarPlus, Plus} from 'lucide-react-native';
import React, {useCallback, useMemo, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';

import {MatchCard} from '../../components/match/MatchCard';
import {AppText} from '../../components/ui/AppText';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {EmptyState} from '../../components/ui/EmptyState';
import {Screen} from '../../components/ui/Screen';
import {StatPill} from '../../components/ui/StatPill';
import {useAuth} from '../../context/AuthContext';
import {useCurrentTime} from '../../hooks/useCurrentTime';
import {fetchMatchRequests, fetchMatches} from '../../services/matchService';
import {
  notifyInBackground,
  sendDueMatchReminders,
} from '../../services/notificationService';
import {colors, spacing} from '../../theme/theme';
import {isPreviousMatch, isUpcomingMatch} from '../../utils/match';
import type {Match, MatchRequest} from '../../types/domain';
import type {
  MatchesTab,
  RootStackParamList,
  TabParamList,
} from '../../types/navigation';

type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const {isAdmin, profile} = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [requests, setRequests] = useState<MatchRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const currentTime = useCurrentTime();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [matchRows, requestRows] = await Promise.all([
        fetchMatches(),
        fetchMatchRequests(),
      ]);
      setMatches(matchRows);
      setRequests(requestRows.requests);
      notifyInBackground(sendDueMatchReminders(matchRows));
    } catch (error) {
      Alert.alert('Load error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openMatch = useCallback(
    (matchId: string) => {
      const parentNavigation =
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

      if (parentNavigation) {
        parentNavigation.navigate('MatchDetail', {matchId});
        return;
      }

      navigation.navigate('MatchDetail', {matchId});
    },
    [navigation],
  );

  const openMatchesTab = useCallback(
    (initialTab: MatchesTab) => {
      navigation.navigate('Matches', {initialTab});
    },
    [navigation],
  );

  const nextMatch = useMemo(
    () =>
      matches
        .filter(match => isUpcomingMatch(match, currentTime))
        .sort((a, b) => a.match_date.localeCompare(b.match_date))[0],
    [currentTime, matches],
  );
  const latestPreviousMatch = useMemo(
    () =>
      matches
        .filter(match => isPreviousMatch(match, currentTime))
        .sort((a, b) => b.match_date.localeCompare(a.match_date))[0],
    [currentTime, matches],
  );
  const openRequests = requests.filter(request => request.status === 'open').length;
  const upcomingCount = matches.filter(match =>
    isUpcomingMatch(match, currentTime),
  ).length;
  const playedCount = matches.filter(match =>
    isPreviousMatch(match, currentTime),
  ).length;

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <AppText variant="label" muted>
            Welcome back
          </AppText>
          <AppText variant="title">{profile?.first_name || profile?.username}</AppText>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Request match"
          icon={<CalendarPlus color={colors.white} size={17} />}
          onPress={() => navigation.navigate('CreateMatchRequest')}
          style={styles.action}
        />
        {isAdmin ? (
          <Button
            label="Schedule"
            icon={<Plus color={colors.text} size={17} />}
            variant="secondary"
            onPress={() => navigation.navigate('AdminMatchForm')}
            style={styles.action}
          />
        ) : null}
      </View>

      <View style={styles.stats}>
        <StatPill
          label="Upcoming"
          value={upcomingCount}
          onPress={() => openMatchesTab('upcoming')}
        />
        <StatPill
          label="Requests"
          value={openRequests}
          onPress={() => openMatchesTab('requests')}
          tone="blue"
        />
        <StatPill
          label="Played"
          value={playedCount}
          onPress={() => openMatchesTab('previous')}
        />
      </View>

      <View style={styles.section}>
        <AppText variant="heading">Next match</AppText>
        {nextMatch ? (
          <MatchCard
            match={nextMatch}
            onPress={() => openMatch(nextMatch.id)}
          />
        ) : (
          <EmptyState
            title={loading ? 'Loading...' : 'No match scheduled'}
            body="Request one and let the group vote."
          />
        )}
      </View>

      <View style={styles.section}>
        <AppText variant="heading">Latest result</AppText>
        {latestPreviousMatch ? (
          <MatchCard
            match={latestPreviousMatch}
            onPress={() => openMatch(latestPreviousMatch.id)}
          />
        ) : (
          <Card>
            <AppText muted>Previous match results will appear here.</AppText>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  action: {
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  section: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
});
