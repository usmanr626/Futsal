import {supabase} from '../config/supabase';
import type {
  FunAward,
  Goal,
  LeaderboardRowData,
  Match,
  MatchComment,
  MatchMedia,
  MatchParticipant,
  MatchParticipantTeam,
  MatchRequest,
  MatchRequestParticipant,
  MatchRequestVote,
  PlayerStats,
  PlayerStatSummary,
  Profile,
  VoteChoice,
} from '../types/domain';
import {playerName} from '../utils/player';

type MatchStatRow = Pick<
  Match,
  | 'id'
  | 'title'
  | 'match_date'
  | 'status'
  | 'team_a_name'
  | 'team_b_name'
  | 'team_a_score'
  | 'team_b_score'
  | 'motm_user_id'
>;

type ParticipantStatRow = {
  match_id: string;
  user_id: string;
  team: MatchParticipantTeam;
};

type GoalStatRow = {
  match_id: string;
  scorer_id: string;
  team: 'team_a' | 'team_b' | null;
  minute: number | null;
};

type StatData = {
  matches: MatchStatRow[];
  participants: ParticipantStatRow[];
  goals: GoalStatRow[];
  profiles: Profile[];
};

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return new Error(error.message);
  }

  return new Error(fallback);
}

export async function fetchProfiles() {
  const {data, error} = await supabase
    .from('profiles')
    .select('*')
    .order('username');

  if (error) {
    throw toError(error, 'Could not load profiles.');
  }

  return (data ?? []) as Profile[];
}

export async function fetchMatches() {
  const {data, error} = await supabase
    .from('matches')
    .select('*, motm:profiles!matches_motm_user_id_fkey(*)')
    .order('match_date', {ascending: true});

  if (error) {
    throw error;
  }

  return (data ?? []) as Match[];
}

export async function fetchMatch(matchId: string) {
  const {data, error} = await supabase
    .from('matches')
    .select('*, motm:profiles!matches_motm_user_id_fkey(*)')
    .eq('id', matchId)
    .single();

  if (error) {
    throw error;
  }

  return data as Match;
}

export async function fetchGoals(matchId: string) {
  const {data, error} = await supabase
    .from('goals')
    .select(
      '*, scorer:profiles!goals_scorer_id_fkey(*), assist:profiles!goals_assist_id_fkey(*)',
    )
    .eq('match_id', matchId)
    .order('minute', {ascending: true, nullsFirst: false});

  if (error) {
    throw error;
  }

  return (data ?? []) as Goal[];
}

export async function fetchMedia(matchId: string) {
  const {data, error} = await supabase
    .from('match_media')
    .select('*')
    .eq('match_id', matchId)
    .order('sort_order', {ascending: true});

  if (error) {
    throw error;
  }

  return (data ?? []) as MatchMedia[];
}

export async function fetchMatchParticipants(matchId: string) {
  const {data, error} = await supabase
    .from('match_participants')
    .select('*, profile:profiles!match_participants_user_id_fkey(*)')
    .eq('match_id', matchId)
    .order('created_at', {ascending: true});

  if (error) {
    throw error;
  }

  return (data ?? []) as MatchParticipant[];
}

export async function fetchMatchRequests() {
  const [
    {data: requests, error: requestError},
    {data: votes, error: voteError},
    {data: participants, error: participantError},
    {data: profiles, error: profileError},
  ] = await Promise.all([
    supabase
      .from('match_requests')
      .select('*, requester:profiles!match_requests_requested_by_fkey(*)')
      .order('created_at', {ascending: false}),
    supabase.from('match_request_votes').select('*'),
    supabase
      .from('match_request_participants')
      .select('*, profile:profiles!match_request_participants_user_id_fkey(*)')
      .order('created_at', {ascending: true}),
    supabase.from('profiles').select('*'),
  ]);

  if (requestError) {
    throw requestError;
  }

  if (voteError) {
    throw voteError;
  }

  if (participantError) {
    throw participantError;
  }

  if (profileError) {
    throw profileError;
  }

  const profilesById = new Map(
    ((profiles ?? []) as Profile[]).map(profile => [profile.id, profile]),
  );

  return {
    requests: (requests ?? []) as MatchRequest[],
    participants: (participants ?? []) as MatchRequestParticipant[],
    votes: ((votes ?? []) as MatchRequestVote[]).map(vote => ({
      ...vote,
      profile: profilesById.get(vote.user_id) ?? null,
    })),
  };
}

export async function createMatchRequest(values: {
  requested_by: string;
  requested_date: string;
  venue: string;
  note: string;
}) {
  const {data, error} = await supabase
    .from('match_requests')
    .insert(values)
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function submitVote(requestId: string, vote: VoteChoice) {
  const {data, error} = await supabase.rpc('submit_match_request_vote', {
    p_request_id: requestId,
    p_vote: vote,
  });

  if (error) {
    throw error;
  }

  return data as MatchRequest;
}

export async function updateMatchRequest(values: {
  requestId: string;
  requestedDate: string;
  venue: string;
  note: string;
  teamAUserIds: string[];
  teamBUserIds: string[];
}) {
  const {data, error} = await supabase.rpc('update_match_request', {
    p_request_id: values.requestId,
    p_requested_date: values.requestedDate,
    p_venue: values.venue,
    p_note: values.note,
    p_team_a_user_ids: values.teamAUserIds,
    p_team_b_user_ids: values.teamBUserIds,
  });

  if (error) {
    throw error;
  }

  return data as MatchRequest;
}

export async function deleteMatchRequest(request: MatchRequest) {
  const {error} = await supabase.rpc('delete_match_request', {
    p_request_id: request.id,
  });

  if (error) {
    throw toError(error, 'Could not delete request.');
  }
}

export async function upsertMatch(values: Partial<Match> & {id?: string}) {
  if (values.id) {
    const {id, ...rest} = values;
    const {error} = await supabase.from('matches').update(rest).eq('id', id);

    if (error) {
      throw error;
    }

    return id;
  }

  const {data, error} = await supabase
    .from('matches')
    .insert(values)
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function upsertMatchParticipants(
  matchId: string,
  values: {teamAUserIds: string[]; teamBUserIds: string[]},
) {
  const {error: deleteError} = await supabase
    .from('match_participants')
    .delete()
    .eq('match_id', matchId);

  if (deleteError) {
    throw deleteError;
  }

  const rows = [
    ...values.teamAUserIds.map(userId => ({
      match_id: matchId,
      user_id: userId,
      team: 'team_a',
    })),
    ...values.teamBUserIds.map(userId => ({
      match_id: matchId,
      user_id: userId,
      team: 'team_b',
    })),
  ];

  if (!rows.length) {
    return;
  }

  const {error} = await supabase.from('match_participants').insert(rows);

  if (error) {
    throw error;
  }
}

export async function upsertMatchRequestParticipants(
  requestId: string,
  values: {teamAUserIds: string[]; teamBUserIds: string[]},
) {
  const {error: deleteError} = await supabase
    .from('match_request_participants')
    .delete()
    .eq('request_id', requestId);

  if (deleteError) {
    throw deleteError;
  }

  const rows = [
    ...values.teamAUserIds.map(userId => ({
      request_id: requestId,
      user_id: userId,
      team: 'team_a',
    })),
    ...values.teamBUserIds.map(userId => ({
      request_id: requestId,
      user_id: userId,
      team: 'team_b',
    })),
  ];

  if (!rows.length) {
    return;
  }

  const {error} = await supabase.from('match_request_participants').insert(rows);

  if (error) {
    throw error;
  }
}

export async function addGoal(values: {
  matchId: string;
  scorerId: string;
  team: 'team_a' | 'team_b';
  minute: number | null;
}) {
  const {error} = await supabase.from('goals').insert({
    match_id: values.matchId,
    scorer_id: values.scorerId,
    team: values.team,
    minute: values.minute,
  });

  if (error) {
    throw error;
  }
}

export async function deleteGoal(goalId: string) {
  const {error} = await supabase.from('goals').delete().eq('id', goalId);

  if (error) {
    throw error;
  }
}

export async function deleteMatch(matchId: string) {
  const media = await fetchMedia(matchId);
  const mediaByBucket = media.reduce<Record<string, string[]>>((grouped, item) => {
    grouped[item.storage_bucket] = grouped[item.storage_bucket] ?? [];
    grouped[item.storage_bucket].push(item.storage_path);
    return grouped;
  }, {});

  for (const [bucket, paths] of Object.entries(mediaByBucket)) {
    if (!paths.length) {
      continue;
    }

    const {error} = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      throw error;
    }
  }

  const {error} = await supabase.from('matches').delete().eq('id', matchId);

  if (error) {
    throw error;
  }
}

export async function fetchLeaderboard(tab: 'goals' | 'motm' | 'appearances') {
  const table =
    tab === 'goals'
      ? 'leaderboard_goals'
      : tab === 'motm'
        ? 'leaderboard_motm'
        : 'leaderboard_appearances';

  const orderColumn =
    tab === 'goals'
      ? 'goals'
      : tab === 'motm'
        ? 'motm_count'
        : 'matches_played';

  const {data, error} = await supabase
    .from(table)
    .select('*')
    .order(orderColumn, {ascending: false});

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as LeaderboardRowData[];
  const userIds = rows.map(row => row.user_id);

  if (!userIds.length) {
    return rows;
  }

  const {data: profiles, error: profileError} = await supabase
    .from('profiles')
    .select('id, avatar_path')
    .in('id', userIds);

  if (profileError) {
    throw profileError;
  }

  const avatarPathsByUserId = new Map(
    (profiles ?? []).map(profile => [
      profile.id as string,
      profile.avatar_path as string | null,
    ]),
  );

  return rows.map(row => ({
    ...row,
    avatar_path: avatarPathsByUserId.get(row.user_id) ?? null,
  }));
}

export async function fetchPlayerStatSummaries() {
  const statData = await fetchStatData();
  const statsByUserId = computePlayerStats(statData);

  return Object.fromEntries(
    Array.from(statsByUserId.entries()).map(([userId, stats]) => [
      userId,
      {
        user_id: stats.user_id,
        goals: stats.goals,
        matches_played: stats.matches_played,
        motm_count: stats.motm_count,
      },
    ]),
  ) as Record<string, PlayerStatSummary>;
}

export async function fetchPlayerStats(userId: string) {
  const statData = await fetchStatData();
  const statsByUserId = computePlayerStats(statData);

  return statsByUserId.get(userId) ?? emptyPlayerStats(userId);
}

export async function fetchFunAwards() {
  const statData = await fetchStatData();
  const statsByUserId = computePlayerStats(statData);
  const profilesById = profileMap(statData.profiles);
  const stats = Array.from(statsByUserId.values());

  return [
    topPlayerAward({
      id: 'top_scorer',
      title: 'Top scorer',
      metric: 'goals',
      unit: 'goals',
      stats,
      profilesById,
    }),
    topPlayerAward({
      id: 'most_motm',
      title: 'Most MOTM',
      metric: 'motm_count',
      unit: 'MOTM awards',
      stats,
      profilesById,
    }),
    topPlayerAward({
      id: 'most_appearances',
      title: 'Most appearances',
      metric: 'matches_played',
      unit: 'appearances',
      stats,
      profilesById,
    }),
    comebackAward(statData, profilesById),
    keeperAward(statData, profilesById),
    biggestWinAward(statData, profilesById),
  ];
}

export async function fetchMatchComments(
  matchId: string,
  options: {limit: number; offset: number},
) {
  const from = options.offset;
  const to = options.offset + options.limit - 1;
  const {data, error, count} = await supabase
    .from('match_comments')
    .select('*, profile:profiles!match_comments_user_id_fkey(*)', {
      count: 'exact',
    })
    .eq('match_id', matchId)
    .order('created_at', {ascending: false})
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    comments: (data ?? []) as MatchComment[],
    total: count ?? 0,
  };
}

export async function addMatchComment(values: {
  matchId: string;
  userId: string;
  body: string;
}) {
  const {data, error} = await supabase
    .from('match_comments')
    .insert({
      match_id: values.matchId,
      user_id: values.userId,
      body: values.body,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function deleteMatchComment(commentId: string) {
  const {error} = await supabase
    .from('match_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    throw error;
  }
}

async function fetchStatData(): Promise<StatData> {
  const [
    {data: matches, error: matchError},
    {data: participants, error: participantError},
    {data: goals, error: goalError},
    {data: profiles, error: profileError},
  ] = await Promise.all([
    supabase
      .from('matches')
      .select(
        'id, title, match_date, status, team_a_name, team_b_name, team_a_score, team_b_score, motm_user_id',
      ),
    supabase.from('match_participants').select('match_id, user_id, team'),
    supabase.from('goals').select('match_id, scorer_id, team, minute'),
    supabase.from('profiles').select('*'),
  ]);

  if (matchError) {
    throw matchError;
  }

  if (participantError) {
    throw participantError;
  }

  if (goalError) {
    throw goalError;
  }

  if (profileError) {
    throw profileError;
  }

  return {
    matches: (matches ?? []) as MatchStatRow[],
    participants: (participants ?? []) as ParticipantStatRow[],
    goals: (goals ?? []) as GoalStatRow[],
    profiles: (profiles ?? []) as Profile[],
  };
}

function computePlayerStats(statData: StatData) {
  const statsByUserId = new Map<string, PlayerStats>();
  const resultMatchesByUserId = new Map<string, number>();
  const previousMatches = statData.matches.filter(isStatsMatch);
  const previousMatchIds = new Set(previousMatches.map(match => match.id));
  const matchesById = new Map(previousMatches.map(match => [match.id, match]));

  statData.profiles.forEach(profile => {
    statsByUserId.set(profile.id, emptyPlayerStats(profile.id));
  });

  statData.participants.forEach(participant => {
    if (
      !previousMatchIds.has(participant.match_id) ||
      participant.team === 'unassigned'
    ) {
      return;
    }

    const match = matchesById.get(participant.match_id);
    if (!match) {
      return;
    }

    const stats = ensureStats(statsByUserId, participant.user_id);
    stats.matches_played += 1;

    if (
      !stats.last_played_at ||
      match.match_date.localeCompare(stats.last_played_at) > 0
    ) {
      stats.last_played_at = match.match_date;
    }

    if (hasScore(match)) {
      resultMatchesByUserId.set(
        participant.user_id,
        (resultMatchesByUserId.get(participant.user_id) ?? 0) + 1,
      );

      if (winningTeam(match) === participant.team) {
        stats.wins += 1;
      }
    }
  });

  statData.goals.forEach(goal => {
    if (!previousMatchIds.has(goal.match_id)) {
      return;
    }

    ensureStats(statsByUserId, goal.scorer_id).goals += 1;
  });

  previousMatches.forEach(match => {
    if (match.motm_user_id) {
      ensureStats(statsByUserId, match.motm_user_id).motm_count += 1;
    }
  });

  statsByUserId.forEach(stats => {
    const resultMatches = resultMatchesByUserId.get(stats.user_id) ?? 0;
    stats.win_rate = resultMatches
      ? Math.round((stats.wins / resultMatches) * 100)
      : 0;
  });

  return statsByUserId;
}

function emptyPlayerStats(userId: string): PlayerStats {
  return {
    user_id: userId,
    goals: 0,
    matches_played: 0,
    motm_count: 0,
    wins: 0,
    win_rate: 0,
    last_played_at: null,
  };
}

function ensureStats(statsByUserId: Map<string, PlayerStats>, userId: string) {
  const existing = statsByUserId.get(userId);
  if (existing) {
    return existing;
  }

  const stats = emptyPlayerStats(userId);
  statsByUserId.set(userId, stats);
  return stats;
}

function isStatsMatch(match: MatchStatRow) {
  const status = match.status as string;

  return (
    status === 'completed' ||
    ((status === 'upcoming' || status === 'scheduled') &&
      new Date(match.match_date).getTime() <= Date.now())
  );
}

function hasScore(match: Pick<Match, 'team_a_score' | 'team_b_score'>) {
  return match.team_a_score !== null && match.team_b_score !== null;
}

function winningTeam(match: Pick<Match, 'team_a_score' | 'team_b_score'>) {
  if (!hasScore(match) || match.team_a_score === match.team_b_score) {
    return null;
  }

  return match.team_a_score! > match.team_b_score! ? 'team_a' : 'team_b';
}

function profileMap(profiles: Profile[]) {
  return new Map(profiles.map(profile => [profile.id, profile]));
}

function topPlayerAward(input: {
  id: string;
  title: string;
  metric: keyof Pick<PlayerStats, 'goals' | 'matches_played' | 'motm_count'>;
  unit: string;
  stats: PlayerStats[];
  profilesById: Map<string, Profile>;
}): FunAward {
  const top = input.stats
    .filter(stats => input.profilesById.has(stats.user_id))
    .sort((a, b) => b[input.metric] - a[input.metric])[0];
  const value = top?.[input.metric] ?? 0;

  if (!top || value <= 0) {
    return {
      id: input.id,
      title: input.title,
      winner: 'Waiting for a winner',
      detail: 'This badge unlocks after more match data is added.',
    };
  }

  return {
    id: input.id,
    title: input.title,
    winner: nameForUser(top.user_id, input.profilesById),
    detail: `${value} ${input.unit}`,
  };
}

function comebackAward(
  statData: StatData,
  profilesById: Map<string, Profile>,
): FunAward {
  const previousMatchIds = new Set(
    statData.matches.filter(isStatsMatch).map(match => match.id),
  );
  const goalsByMatchId = groupBy(statData.goals, goal => goal.match_id);
  let best:
    | {
        match: MatchStatRow;
        winnerTeam: 'team_a' | 'team_b';
        deficit: number;
      }
    | null = null;

  for (const match of statData.matches) {
    if (!previousMatchIds.has(match.id)) {
      continue;
    }

    const winnerTeam = winningTeam(match);
    if (!winnerTeam) {
      continue;
    }

    let teamAScore = 0;
    let teamBScore = 0;
    let biggestDeficit = 0;
    const goals = [...(goalsByMatchId.get(match.id) ?? [])].sort(
      (a, b) => (a.minute ?? 999) - (b.minute ?? 999),
    );

    for (const goal of goals) {
      if (goal.team === 'team_a') {
        teamAScore += 1;
      }
      if (goal.team === 'team_b') {
        teamBScore += 1;
      }

      const deficit =
        winnerTeam === 'team_a'
          ? teamBScore - teamAScore
          : teamAScore - teamBScore;
      biggestDeficit = Math.max(biggestDeficit, deficit);
    }

    if (biggestDeficit > 0 && (!best || biggestDeficit > best.deficit)) {
      best = {match, winnerTeam, deficit: biggestDeficit};
    }
  }

  if (!best) {
    return {
      id: 'comeback_king',
      title: 'Comeback king',
      winner: 'No comeback yet',
      detail: 'Add goal minutes to unlock this one properly.',
    };
  }

  return {
    id: 'comeback_king',
    title: 'Comeback king',
    winner: participantNames(statData, best.match.id, best.winnerTeam, profilesById),
    detail: `Came back from ${best.deficit} down in ${best.match.title}.`,
  };
}

function keeperAward(
  statData: StatData,
  profilesById: Map<string, Profile>,
): FunAward {
  const matchesById = new Map(
    statData.matches.filter(match => isStatsMatch(match) && hasScore(match)).map(
      match => [match.id, match],
    ),
  );
  let best:
    | {
        participant: ParticipantStatRow;
        match: MatchStatRow;
        conceded: number;
      }
    | null = null;

  for (const participant of statData.participants) {
    const match = matchesById.get(participant.match_id);
    const profile = profilesById.get(participant.user_id);

    if (!match || !profile || !isKeeper(profile) || participant.team === 'unassigned') {
      continue;
    }

    const conceded =
      participant.team === 'team_a' ? match.team_b_score! : match.team_a_score!;

    if (
      !best ||
      conceded < best.conceded ||
      (conceded === best.conceded &&
        match.match_date.localeCompare(best.match.match_date) > 0)
    ) {
      best = {participant, match, conceded};
    }
  }

  if (!best) {
    return {
      id: 'keeper_of_the_day',
      title: 'Keeper of the day',
      winner: 'No keeper tagged yet',
      detail: 'Set favorite position to GK or keeper to unlock this badge.',
    };
  }

  return {
    id: 'keeper_of_the_day',
    title: 'Keeper of the day',
    winner: nameForUser(best.participant.user_id, profilesById),
    detail: `Conceded ${best.conceded} in ${best.match.title}.`,
  };
}

function biggestWinAward(
  statData: StatData,
  profilesById: Map<string, Profile>,
): FunAward {
  let best:
    | {
        match: MatchStatRow;
        winnerTeam: 'team_a' | 'team_b';
        difference: number;
      }
    | null = null;

  for (const match of statData.matches.filter(isStatsMatch)) {
    const winnerTeam = winningTeam(match);
    if (!winnerTeam) {
      continue;
    }

    const difference = Math.abs(match.team_a_score! - match.team_b_score!);
    if (!best || difference > best.difference) {
      best = {match, winnerTeam, difference};
    }
  }

  if (!best) {
    return {
      id: 'biggest_win',
      title: 'Biggest win participant',
      winner: 'No big win yet',
      detail: 'This appears once a completed match has a winner.',
    };
  }

  return {
    id: 'biggest_win',
    title: 'Biggest win participant',
    winner: participantNames(statData, best.match.id, best.winnerTeam, profilesById),
    detail: `${best.match.team_a_name} ${best.match.team_a_score}-${best.match.team_b_score} ${best.match.team_b_name}`,
  };
}

function participantNames(
  statData: StatData,
  matchId: string,
  team: 'team_a' | 'team_b',
  profilesById: Map<string, Profile>,
) {
  const names = statData.participants
    .filter(participant => participant.match_id === matchId && participant.team === team)
    .map(participant => nameForUser(participant.user_id, profilesById));

  if (!names.length) {
    return 'Winning team';
  }

  return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
}

function nameForUser(userId: string, profilesById: Map<string, Profile>) {
  return playerName(profilesById.get(userId));
}

function isKeeper(profile: Profile) {
  const position = profile.favorite_position?.toLowerCase() ?? '';

  return (
    position.includes('keeper') ||
    position.includes('goalkeeper') ||
    position.includes('goalie') ||
    position.split(/\s|,|\//).includes('gk')
  );
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
    return groups;
  }, new Map<string, T[]>());
}
