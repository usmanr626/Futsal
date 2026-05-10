import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';

import {TeamMemberSelector} from '../../components/match/TeamMemberSelector';
import {AppText} from '../../components/ui/AppText';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {DateTimeField} from '../../components/ui/DateTimeField';
import {Screen} from '../../components/ui/Screen';
import {TextField} from '../../components/ui/TextField';
import {useAuth} from '../../context/AuthContext';
import {
  createMatchRequest,
  fetchMatchRequests,
  fetchProfiles,
  submitVote,
  updateMatchRequest,
  upsertMatchRequestParticipants,
} from '../../services/matchService';
import {
  notifyInBackground,
  notifyMatchRequestCreated,
  notifyMatchScheduled,
} from '../../services/notificationService';
import {colors, spacing} from '../../theme/theme';
import type {MatchRequest, MatchRequestParticipant, Profile} from '../../types/domain';
import type {RootStackParamList} from '../../types/navigation';
import {isWithinLast24Hours} from '../../utils/rateLimits';
import {validateTeamSelection} from '../../utils/teamValidation';
import {maxLength, required} from '../../utils/validation';

type Route = RouteProp<RootStackParamList, 'CreateMatchRequest'>;

type RequestErrors = {
  venue?: string;
  note?: string;
  teamMembers?: string;
};

export function CreateMatchRequestScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const {session} = useAuth();
  const [date, setDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [venue, setVenue] = useState('');
  const [note, setNote] = useState('');
  const [editingRequestId, setEditingRequestId] = useState<string | null>(
    route.params?.requestId ?? null,
  );
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teamAUserIds, setTeamAUserIds] = useState<string[]>([]);
  const [teamBUserIds, setTeamBUserIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<RequestErrors>({});
  const [loading, setLoading] = useState(false);
  const activeProfiles = useMemo(
    () => profiles.filter(profile => profile.is_active),
    [profiles],
  );

  const applyRequest = useCallback(
    (request: MatchRequest, participants: MatchRequestParticipant[]) => {
      setEditingRequestId(request.id);
      setDate(new Date(request.requested_date));
      setVenue(request.venue ?? '');
      setNote(request.note ?? '');
      setTeamAUserIds(
        participants
          .filter(
            participant =>
              participant.request_id === request.id &&
              participant.team === 'team_a',
          )
          .map(participant => participant.user_id),
      );
      setTeamBUserIds(
        participants
          .filter(
            participant =>
              participant.request_id === request.id &&
              participant.team === 'team_b',
          )
          .map(participant => participant.user_id),
      );
    },
    [],
  );

  useEffect(() => {
    async function load() {
      const [profileRows, requestRows] = await Promise.all([
        fetchProfiles(),
        fetchMatchRequests(),
      ]);
      setProfiles(profileRows);

      if (!session?.user.id) {
        return;
      }

      const requestedRequest = route.params?.requestId
        ? requestRows.requests.find(request => request.id === route.params?.requestId)
        : null;
      const recentOwnRequests = requestRows.requests
        .filter(
          request =>
            request.requested_by === session.user.id &&
            isWithinLast24Hours(request.created_at),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const recentOpenRequest = recentOwnRequests.find(
        request => request.status === 'open',
      );

      if (requestedRequest) {
        applyRequest(requestedRequest, requestRows.participants);
        return;
      }

      if (recentOpenRequest) {
        applyRequest(recentOpenRequest, requestRows.participants);
        return;
      }

      if (recentOwnRequests.length) {
        Alert.alert(
          'One request a day',
          'You already requested a match today. Since this is a free app, we have to stop match-request spam for 24 hours.',
          [{text: 'OK', onPress: () => navigation.goBack()}],
        );
      }
    }

    load().catch(error =>
      Alert.alert('Load error', error instanceof Error ? error.message : 'Try again.'),
    );
  }, [applyRequest, navigation, route.params?.requestId, session?.user.id]);

  const validate = () => {
    const nextErrors: RequestErrors = {
      venue: required(venue, 'Venue'),
      note: maxLength(note, 'Note', 280),
      teamMembers: validateTeamSelection(teamAUserIds, teamBUserIds),
    };

    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const submit = async () => {
    if (!session?.user) {
      return;
    }

    if (!validate()) {
      return;
    }

    if (date.getTime() <= Date.now()) {
      Alert.alert('Pick a future time', 'Match requests need a future date and time.');
      return;
    }

    try {
      setLoading(true);
      const requestId = editingRequestId
        ? (
            await updateMatchRequest({
              requestId: editingRequestId,
              requestedDate: date.toISOString(),
              venue: venue.trim(),
              note: note.trim(),
              teamAUserIds,
              teamBUserIds,
            })
          ).id
        : await createMatchRequest({
            requested_by: session.user.id,
            requested_date: date.toISOString(),
            venue: venue.trim(),
            note: note.trim(),
          });

      if (!editingRequestId) {
        await upsertMatchRequestParticipants(requestId, {
          teamAUserIds,
          teamBUserIds,
        });
      }

      const updatedRequest = await submitVote(requestId, 'yes');
      if (!editingRequestId) {
        notifyInBackground(notifyMatchRequestCreated(requestId));
      }
      if (
        updatedRequest.status === 'scheduled' &&
        updatedRequest.scheduled_match_id
      ) {
        notifyInBackground(
          notifyMatchScheduled(updatedRequest.scheduled_match_id),
        );
      }
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      Alert.alert(
        'Request error',
        message.includes('one match') || message.includes('one match every 24')
          ? 'You already requested a match today. Since this is a free app, we have to stop match-request spam for 24 hours.'
          : message || 'Could not create request.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title">
        {editingRequestId ? 'Edit request' : 'Request match'}
      </AppText>
      <AppText muted style={styles.copy}>
        Your vote is added as yes automatically. The group can vote from the
        Requests tab.
      </AppText>

      <Card style={styles.card}>
        <DateTimeField
          label="Date and time"
          minimumDate={new Date()}
          value={date}
          onChange={setDate}
        />
        <TextField
          error={errors.venue}
          label="Venue"
          onChangeText={value => {
            setVenue(value);
            setErrors(current => ({...current, venue: undefined}));
          }}
          placeholder="Court name"
          value={venue}
        />
        <TextField
          error={errors.note}
          label="Note"
          multiline
          onChangeText={value => {
            setNote(value);
            setErrors(current => ({...current, note: undefined}));
          }}
          placeholder="Any details for the group"
          value={note}
        />
        <View style={styles.teamSection}>
          <AppText variant="heading">Teams</AppText>
          <TeamMemberSelector
            profiles={activeProfiles}
            teamAName="Team A"
            teamAUserIds={teamAUserIds}
            teamBName="Team B"
            teamBUserIds={teamBUserIds}
            onChange={next => {
              setTeamAUserIds(next.teamAUserIds);
              setTeamBUserIds(next.teamBUserIds);
              setErrors(current => ({...current, teamMembers: undefined}));
            }}
          />
          {errors.teamMembers ? (
            <AppText variant="small" style={styles.error}>
              {errors.teamMembers}
            </AppText>
          ) : null}
        </View>
        <Button label="Submit request" loading={loading} onPress={submit} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: {
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  card: {
    gap: spacing.lg,
  },
  teamSection: {
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
  },
});
