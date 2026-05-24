import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Plus} from 'lucide-react-native';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';

import {MatchCard} from '../../components/match/MatchCard';
import {RequestCard} from '../../components/match/RequestCard';
import {AppText} from '../../components/ui/AppText';
import {Button} from '../../components/ui/Button';
import {EmptyState} from '../../components/ui/EmptyState';
import {Screen} from '../../components/ui/Screen';
import {SegmentedControl} from '../../components/ui/SegmentedControl';
import {useAuth} from '../../context/AuthContext';
import {useCurrentTime} from '../../hooks/useCurrentTime';
import {
  deleteMatchRequest,
  fetchMatchRequests,
  fetchMatches,
  submitVote,
} from '../../services/matchService';
import {
  notifyInBackground,
  notifyMatchRequestVote,
  notifyMatchScheduled,
  sendDueMatchReminders,
} from '../../services/notificationService';
import {colors, spacing} from '../../theme/theme';
import type {
  Match,
  MatchRequest,
  MatchRequestParticipant,
  MatchRequestVote,
  VoteChoice,
} from '../../types/domain';
import type {
  MatchesTab,
  RootStackParamList,
  TabParamList,
} from '../../types/navigation';
import {isPreviousMatch, isUpcomingMatch} from '../../utils/match';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<TabParamList, 'Matches'>;

export function MatchesScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const {session, isAdmin} = useAuth();
  const [tab, setTab] = useState<MatchesTab>('upcoming');
  const [matches, setMatches] = useState<Match[]>([]);
  const [requests, setRequests] = useState<MatchRequest[]>([]);
  const [requestParticipants, setRequestParticipants] = useState<
    MatchRequestParticipant[]
  >([]);
  const [votes, setVotes] = useState<MatchRequestVote[]>([]);
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
      setRequestParticipants(requestRows.participants);
      setVotes(requestRows.votes);
      notifyInBackground(sendDueMatchReminders(matchRows));
    } catch (error) {
      Alert.alert('Load error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.initialTab) {
        setTab(route.params.initialTab);
      }

      load();
    }, [load, route.params?.initialTab]),
  );

  useEffect(() => {
    if (route.params?.initialTab) {
      setTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const visibleMatches = useMemo(() => {
    if (tab === 'upcoming') {
      return matches
        .filter(match => isUpcomingMatch(match, currentTime))
        .sort((a, b) => a.match_date.localeCompare(b.match_date));
    }

    if (tab === 'previous') {
      return matches
        .filter(match => isPreviousMatch(match, currentTime))
        .sort((a, b) => b.match_date.localeCompare(a.match_date));
    }

    return [];
  }, [currentTime, matches, tab]);

  const visibleRequests = useMemo(
    () => requests.filter(request => request.status === 'open'),
    [requests],
  );
  const ownOpenRequest = useMemo(
    () =>
      visibleRequests.find(request => request.requested_by === session?.user.id) ??
      null,
    [session?.user.id, visibleRequests],
  );

  const vote = async (requestId: string, choice: VoteChoice) => {
    try {
      const updatedRequest = await submitVote(requestId, choice);
      notifyInBackground(notifyMatchRequestVote(requestId));

      if (
        updatedRequest.status === 'scheduled' &&
        updatedRequest.scheduled_match_id
      ) {
        notifyInBackground(
          notifyMatchScheduled(updatedRequest.scheduled_match_id),
        );
      }

      await load();
    } catch (error) {
      Alert.alert('Vote error', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const confirmDeleteRequest = (request: MatchRequest) => {
    const message = request.scheduled_match_id
      ? 'This will delete the request and the scheduled upcoming match it created.'
      : 'This will delete the match request and its votes.';

    Alert.alert('Delete request?', message, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMatchRequest(request);
            await load();
          } catch (error) {
            Alert.alert(
              'Delete error',
              error instanceof Error ? error.message : 'Try again.',
            );
          }
        },
      },
    ]);
  };

  const headerAction = useMemo(() => {
    if (tab === 'requests') {
      return {
        label: ownOpenRequest ? 'Edit request' : 'Request',
        onPress: () =>
          navigation.navigate(
            'CreateMatchRequest',
            ownOpenRequest ? {requestId: ownOpenRequest.id} : undefined,
          ),
      };
    }

    if (!isAdmin) {
      return null;
    }

    if (tab === 'previous') {
      return {
        label: 'Add previous',
        onPress: () =>
          navigation.navigate('AdminMatchForm', {initialStatus: 'completed'}),
      };
    }

    return {
      label: 'Schedule',
      onPress: () =>
        navigation.navigate('AdminMatchForm', {initialStatus: 'upcoming'}),
    };
  }, [isAdmin, navigation, ownOpenRequest, tab]);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">Matches</AppText>
        {headerAction ? (
          <Button
            label={headerAction.label}
            icon={<Plus color={colors.white} size={16} />}
            onPress={headerAction.onPress}
          />
        ) : null}
      </View>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          {label: 'Upcoming', value: 'upcoming'},
          {label: 'Previous', value: 'previous'},
          {label: 'Requests', value: 'requests'},
        ]}
      />

      <View style={styles.list}>
        {tab === 'requests' ? (
          visibleRequests.length ? (
            visibleRequests.map(request => (
              <RequestCard
                key={request.id}
                request={request}
                participants={requestParticipants.filter(
                  participant => participant.request_id === request.id,
                )}
                votes={votes.filter(voteRow => voteRow.request_id === request.id)}
                currentUserId={session?.user.id ?? ''}
                canEdit={request.requested_by === session?.user.id}
                onEdit={() =>
                  navigation.navigate('CreateMatchRequest', {requestId: request.id})
                }
                canDelete={isAdmin}
                onDelete={() => confirmDeleteRequest(request)}
                onVote={choice => vote(request.id, choice)}
              />
            ))
          ) : (
            <EmptyState
              title={loading ? 'Loading...' : 'No requests'}
              body="Any player can request the next match."
            />
          )
        ) : visibleMatches.length ? (
          visibleMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              onPress={() => navigation.navigate('MatchDetail', {matchId: match.id})}
            />
          ))
        ) : (
          <EmptyState
            title={loading ? 'Loading...' : 'Nothing here yet'}
            body={
              tab === 'upcoming'
                ? 'Scheduled matches will appear here.'
                : 'Completed matches will appear here.'
            }
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
