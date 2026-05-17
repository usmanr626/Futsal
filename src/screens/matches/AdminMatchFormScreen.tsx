import {RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ImagePlus, Trash2, Video} from 'lucide-react-native';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {PlayerChips} from '../../components/match/PlayerChips';
import {TeamMemberSelector} from '../../components/match/TeamMemberSelector';
import {AppText} from '../../components/ui/AppText';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {DateTimeField} from '../../components/ui/DateTimeField';
import {Screen} from '../../components/ui/Screen';
import {SegmentedControl} from '../../components/ui/SegmentedControl';
import {TextField} from '../../components/ui/TextField';
import {useAuth} from '../../context/AuthContext';
import {uploadMatchAsset} from '../../services/mediaService';
import {
  addGoal,
  deleteGoal,
  deleteMatch,
  fetchGoals,
  fetchMatch,
  fetchMatchParticipants,
  fetchPlayerStatSummaries,
  fetchProfiles,
  upsertMatch,
  upsertMatchParticipants,
} from '../../services/matchService';
import {
  notifyInBackground,
  notifyMatchScheduled,
} from '../../services/notificationService';
import {colors, spacing} from '../../theme/theme';
import type {
  Goal,
  MatchStatus,
  PlayerStatSummary,
  Profile,
} from '../../types/domain';
import type {RootStackParamList} from '../../types/navigation';
import {playerName} from '../../utils/player';
import {validateTeamSelection} from '../../utils/teamValidation';
import {
  maxLength,
  nonNegativeInteger,
  optionalMinute,
  required,
} from '../../utils/validation';

type Route = RouteProp<RootStackParamList, 'AdminMatchForm'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

type MatchErrors = {
  title?: string;
  venue?: string;
  teamAName?: string;
  teamBName?: string;
  teamAScore?: string;
  teamBScore?: string;
  notes?: string;
  goalMinute?: string;
  teamMembers?: string;
};

function defaultDate(status: MatchStatus) {
  return new Date(
    Date.now() + (status === 'completed' ? -60 * 60 * 1000 : 60 * 60 * 1000),
  );
}

export function AdminMatchFormScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const {session, isAdmin} = useAuth();
  const matchId = route.params?.matchId;
  const isEditing = Boolean(matchId);
  const initialStatus = route.params?.initialStatus ?? 'upcoming';
  const [title, setTitle] = useState('Futsal Match');
  const [date, setDate] = useState(() => defaultDate(initialStatus));
  const [venue, setVenue] = useState('');
  const [status, setStatus] = useState<MatchStatus>(initialStatus);
  const [teamAName, setTeamAName] = useState('Team A');
  const [teamBName, setTeamBName] = useState('Team B');
  const [teamAUserIds, setTeamAUserIds] = useState<string[]>([]);
  const [teamBUserIds, setTeamBUserIds] = useState<string[]>([]);
  const [teamAScore, setTeamAScore] = useState('');
  const [teamBScore, setTeamBScore] = useState('');
  const [motmUserId, setMotmUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [savedMatchId, setSavedMatchId] = useState(matchId);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [playerStats, setPlayerStats] = useState<
    Record<string, PlayerStatSummary>
  >({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalScorerId, setGoalScorerId] = useState<string | null>(null);
  const [goalTeam, setGoalTeam] = useState<'team_a' | 'team_b'>('team_a');
  const [goalMinute, setGoalMinute] = useState('');
  const [errors, setErrors] = useState<MatchErrors>({});
  const [loading, setLoading] = useState(false);

  const activeProfiles = useMemo(
    () => profiles.filter(profile => profile.is_active),
    [profiles],
  );
  const scorerProfiles = useMemo(() => {
    const teamUserIds = goalTeam === 'team_a' ? teamAUserIds : teamBUserIds;
    const teamProfiles = activeProfiles.filter(profile =>
      teamUserIds.includes(profile.id),
    );

    return teamProfiles.length ? teamProfiles : activeProfiles;
  }, [activeProfiles, goalTeam, teamAUserIds, teamBUserIds]);
  const showResults = status === 'completed';

  useEffect(() => {
    if (!showResults || !scorerProfiles.length) {
      return;
    }

    if (!goalScorerId || !scorerProfiles.some(profile => profile.id === goalScorerId)) {
      setGoalScorerId(scorerProfiles[0].id);
    }
  }, [goalScorerId, scorerProfiles, showResults]);

  const loadGoals = useCallback(async (id: string) => {
    setGoals(await fetchGoals(id));
  }, []);

  const load = useCallback(async () => {
    const [profileRows, statRows] = await Promise.all([
      fetchProfiles(),
      fetchPlayerStatSummaries(),
    ]);
    const activeRows = profileRows.filter(profile => profile.is_active);
    setProfiles(profileRows);
    setPlayerStats(statRows);
    setGoalScorerId(current => current ?? activeRows[0]?.id ?? null);

    if (!matchId) {
      return;
    }

    const [match, participants, goalRows] = await Promise.all([
      fetchMatch(matchId),
      fetchMatchParticipants(matchId),
      fetchGoals(matchId),
    ]);

    setTitle(match.title);
    setDate(new Date(match.match_date));
    setVenue(match.venue ?? '');
    setStatus(match.status);
    setTeamAName(match.team_a_name);
    setTeamBName(match.team_b_name);
    setTeamAUserIds(
      participants
        .filter(participant => participant.team === 'team_a')
        .map(participant => participant.user_id),
    );
    setTeamBUserIds(
      participants
        .filter(participant => participant.team === 'team_b')
        .map(participant => participant.user_id),
    );
    setTeamAScore(match.team_a_score?.toString() ?? '');
    setTeamBScore(match.team_b_score?.toString() ?? '');
    setMotmUserId(match.motm_user_id);
    setNotes(match.notes ?? '');
    setSavedMatchId(match.id);
    setGoals(goalRows);
  }, [matchId]);

  useEffect(() => {
    load().catch(error =>
      Alert.alert('Load error', error instanceof Error ? error.message : 'Try again.'),
    );
  }, [load]);

  const validateMatch = () => {
    const nextErrors: MatchErrors = {
      title: required(title, 'Title'),
      venue: required(venue, 'Venue'),
      teamAName: required(teamAName, 'Team A name'),
      teamBName: required(teamBName, 'Team B name'),
      teamMembers: validateTeamSelection(teamAUserIds, teamBUserIds),
      notes: maxLength(notes, 'Notes', 500),
      teamAScore: showResults
        ? nonNegativeInteger(teamAScore, 'Team A score')
        : undefined,
      teamBScore: showResults
        ? nonNegativeInteger(teamBScore, 'Team B score')
        : undefined,
    };

    setErrors(current => ({...current, ...nextErrors}));
    return !Object.values(nextErrors).some(Boolean);
  };

  const save = async () => {
    if (!isAdmin || !session?.user) {
      return;
    }

    if (!validateMatch()) {
      return;
    }

    if (status === 'upcoming' && date.getTime() <= Date.now()) {
      Alert.alert('Pick a future time', 'Scheduled matches need a future date and time.');
      return;
    }

    if (status === 'completed' && date.getTime() > Date.now()) {
      Alert.alert('Pick a past time', 'Previous matches cannot be in the future.');
      return;
    }

    try {
      setLoading(true);
      const isNewMatch = !savedMatchId;
      const id = await upsertMatch({
        id: savedMatchId,
        title: title.trim(),
        match_date: date.toISOString(),
        venue: venue.trim() || null,
        status,
        team_a_name: teamAName.trim() || 'Team A',
        team_b_name: teamBName.trim() || 'Team B',
        team_a_score: showResults && teamAScore ? Number(teamAScore) : null,
        team_b_score: showResults && teamBScore ? Number(teamBScore) : null,
        motm_user_id: showResults ? motmUserId : null,
        notes: notes.trim() || null,
        created_by: session.user.id,
        updated_by: session.user.id,
      });

      await upsertMatchParticipants(id, {teamAUserIds, teamBUserIds});
      if (isNewMatch && status === 'upcoming') {
        notifyInBackground(notifyMatchScheduled(id));
      }
      setSavedMatchId(id);
      Alert.alert('Saved', 'Match saved.');
    } catch (error) {
      Alert.alert('Save error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  const pickMedia = async (type: 'photo' | 'video') => {
    if (!savedMatchId || !session?.user) {
      Alert.alert('Save first', 'Save the completed match before uploading media.');
      return;
    }

    if (!showResults) {
      Alert.alert('Complete match first', 'Media can be added after the match is completed.');
      return;
    }

    const result = await launchImageLibrary({
      includeBase64: type === 'photo',
      mediaType: type,
      selectionLimit: 1,
    });

    if (result.errorMessage) {
      Alert.alert('Media error', result.errorMessage);
      return;
    }

    const asset = result.assets?.[0];
    if (!asset) {
      return;
    }

    try {
      setLoading(true);
      await uploadMatchAsset({
        matchId: savedMatchId,
        asset,
        type,
        uploadedBy: session.user.id,
      });
      Alert.alert('Uploaded', type === 'photo' ? 'Photo added.' : 'Video added.');
    } catch (error) {
      Alert.alert('Upload error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  const addScorer = async () => {
    if (!savedMatchId || !goalScorerId) {
      Alert.alert('Save first', 'Save the completed match and select a scorer.');
      return;
    }

    const goalMinuteError = optionalMinute(goalMinute);
    if (goalMinuteError) {
      setErrors(current => ({...current, goalMinute: goalMinuteError}));
      return;
    }

    const minute = goalMinute.trim() ? Number(goalMinute) : null;

    try {
      setLoading(true);
      await addGoal({
        matchId: savedMatchId,
        scorerId: goalScorerId,
        team: goalTeam,
        minute,
      });
      setGoalMinute('');
      await loadGoals(savedMatchId);
    } catch (error) {
      Alert.alert('Goal error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeGoal = async (goalId: string) => {
    if (!savedMatchId) {
      return;
    }

    try {
      setLoading(true);
      await deleteGoal(goalId);
      await loadGoals(savedMatchId);
    } catch (error) {
      Alert.alert('Goal error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeMatch = () => {
    if (!savedMatchId) {
      return;
    }

    Alert.alert('Delete match?', 'This removes the match, its goals, media, and teams.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await deleteMatch(savedMatchId);
            navigation.goBack();
          } catch (error) {
            Alert.alert(
              'Delete error',
              error instanceof Error ? error.message : 'Try again.',
            );
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  if (!isAdmin) {
    return (
      <Screen>
        <AppText variant="title">Admin only</AppText>
        <AppText muted>This screen is only available to admins.</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">
          {savedMatchId
            ? 'Edit match'
            : initialStatus === 'completed'
              ? 'Add previous match'
              : 'Schedule match'}
        </AppText>
        {savedMatchId ? (
          <Button
            label="Delete"
            icon={<Trash2 color={colors.white} size={16} />}
            loading={loading}
            onPress={removeMatch}
            variant="danger"
          />
        ) : null}
      </View>

      <Card style={styles.card}>
        <TextField
          error={errors.title}
          label="Title"
          onChangeText={value => {
            setTitle(value);
            setErrors(current => ({...current, title: undefined}));
          }}
          value={title}
        />
        <DateTimeField
          label="Date and time"
          maximumDate={status === 'completed' ? new Date() : undefined}
          minimumDate={status === 'upcoming' ? new Date() : undefined}
          onChange={setDate}
          value={date}
        />
        <TextField
          error={errors.venue}
          label="Venue"
          onChangeText={value => {
            setVenue(value);
            setErrors(current => ({...current, venue: undefined}));
          }}
          value={venue}
        />
        {isEditing ? (
          <SegmentedControl
            value={status}
            onChange={setStatus}
            options={[
              {label: 'Upcoming', value: 'upcoming'},
              {label: 'Completed', value: 'completed'},
              {label: 'Cancelled', value: 'cancelled'},
            ]}
          />
        ) : null}
        <View style={styles.row}>
          <TextField
            containerStyle={styles.rowItem}
            error={errors.teamAName}
            label="Team A"
            onChangeText={value => {
              setTeamAName(value);
              setErrors(current => ({...current, teamAName: undefined}));
            }}
            value={teamAName}
          />
          <TextField
            containerStyle={styles.rowItem}
            error={errors.teamBName}
            label="Team B"
            onChangeText={value => {
              setTeamBName(value);
              setErrors(current => ({...current, teamBName: undefined}));
            }}
            value={teamBName}
          />
        </View>
        <TeamMemberSelector
          profiles={activeProfiles}
          statsByUserId={playerStats}
          teamAName={teamAName}
          teamAUserIds={teamAUserIds}
          teamBName={teamBName}
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
        {showResults ? (
          <>
            <View style={styles.row}>
              <TextField
                containerStyle={styles.rowItem}
                error={errors.teamAScore}
                keyboardType="number-pad"
                label="Team A score"
                onChangeText={value => {
                  setTeamAScore(value);
                  setErrors(current => ({...current, teamAScore: undefined}));
                }}
                value={teamAScore}
              />
              <TextField
                containerStyle={styles.rowItem}
                error={errors.teamBScore}
                keyboardType="number-pad"
                label="Team B score"
                onChangeText={value => {
                  setTeamBScore(value);
                  setErrors(current => ({...current, teamBScore: undefined}));
                }}
                value={teamBScore}
              />
            </View>
            <View style={styles.section}>
              <AppText variant="label" muted>
                Man of the Match
              </AppText>
              <PlayerChips
                profiles={activeProfiles}
                selectedIds={motmUserId ? [motmUserId] : []}
                onToggle={profileId =>
                  setMotmUserId(current => (current === profileId ? null : profileId))
                }
              />
            </View>
          </>
        ) : null}
        <TextField
          error={errors.notes}
          label="Notes"
          multiline
          onChangeText={value => {
            setNotes(value);
            setErrors(current => ({...current, notes: undefined}));
          }}
          value={notes}
        />
        <Button label="Save match" loading={loading} onPress={save} />
      </Card>

      {showResults ? (
        <Card style={styles.card}>
          <AppText variant="heading">Goals</AppText>
          {!savedMatchId ? (
            <AppText muted>Save the previous match first, then add each goal.</AppText>
          ) : null}
          {goals.length ? (
            goals.map(goal => (
              <View key={goal.id} style={styles.goalRow}>
                <View style={styles.goalText}>
                  <AppText>
                    {goal.minute !== null ? `${goal.minute}' ` : ''}
                    {playerName(goal.scorer)}
                  </AppText>
                  <AppText variant="small" muted>
                    {goal.team === 'team_a' ? teamAName : teamBName}
                  </AppText>
                </View>
                <Button
                  label="Remove"
                  onPress={() => removeGoal(goal.id)}
                  style={styles.removeButton}
                  variant="secondary"
                />
              </View>
            ))
          ) : savedMatchId ? (
            <AppText muted>Add goals one by one with scorer, team, and minute.</AppText>
          ) : null}
          <SegmentedControl
            value={goalTeam}
            onChange={setGoalTeam}
            options={[
              {label: teamAName || 'Team A', value: 'team_a'},
              {label: teamBName || 'Team B', value: 'team_b'},
            ]}
          />
          <PlayerChips
            profiles={scorerProfiles}
            selectedIds={goalScorerId ? [goalScorerId] : []}
            onToggle={profileId =>
              setGoalScorerId(current => (current === profileId ? null : profileId))
            }
          />
          <TextField
            error={errors.goalMinute}
            keyboardType="number-pad"
            label="Minute"
            onChangeText={value => {
              setGoalMinute(value);
              setErrors(current => ({...current, goalMinute: undefined}));
            }}
            placeholder="Optional"
            value={goalMinute}
          />
          <Button
            label="Add goal"
            disabled={!savedMatchId}
            loading={loading}
            onPress={addScorer}
          />
        </Card>
      ) : null}

      {showResults ? (
        <Card style={styles.card}>
          <AppText variant="heading">Media</AppText>
          <AppText muted>
            {savedMatchId
              ? 'Admins can add up to 3 photos and 1 short video.'
              : 'Save the previous match first, then upload photos and video.'}
          </AppText>
          <View style={styles.actions}>
            <Button
              label="Photo"
              icon={<ImagePlus color={colors.text} size={17} />}
              disabled={!savedMatchId}
              variant="secondary"
              onPress={() => pickMedia('photo')}
              style={styles.action}
            />
            <Button
              label="Video"
              icon={<Video color={colors.text} size={17} />}
              disabled={!savedMatchId}
              variant="secondary"
              onPress={() => pickMedia('video')}
              style={styles.action}
            />
          </View>
        </Card>
      ) : null}

      {savedMatchId ? (
        <Button
          label="Open match detail"
          variant="ghost"
          onPress={() => navigation.navigate('MatchDetail', {matchId: savedMatchId})}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  card: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowItem: {
    flex: 1,
  },
  goalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  goalText: {
    flex: 1,
  },
  removeButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  error: {
    color: colors.danger,
  },
});
