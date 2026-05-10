import {supabase} from '../config/supabase';
import type {
  Goal,
  LeaderboardRowData,
  Match,
  MatchComment,
  MatchMedia,
  MatchParticipant,
  MatchRequest,
  MatchRequestParticipant,
  MatchRequestVote,
  Profile,
  VoteChoice,
} from '../types/domain';

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
    throw toError(error, 'Could not load comments.');
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
    throw toError(error, 'Could not add comment.');
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
