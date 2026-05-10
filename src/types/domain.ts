export type MatchStatus = 'upcoming' | 'completed' | 'cancelled';
export type MatchRequestStatus =
  | 'open'
  | 'scheduled'
  | 'rejected'
  | 'cancelled'
  | 'expired';
export type VoteChoice = 'yes' | 'no' | 'maybe';
export type MediaType = 'photo' | 'video';
export type ReactionType = 'like' | 'dislike';

export type Profile = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  avatar_updated_at: string | null;
  favorite_position: string | null;
  is_active: boolean;
};

export type Match = {
  id: string;
  request_id: string | null;
  title: string;
  match_date: string;
  venue: string | null;
  status: MatchStatus;
  team_a_name: string;
  team_b_name: string;
  team_a_score: number | null;
  team_b_score: number | null;
  motm_user_id: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  motm?: Profile | null;
};

export type MatchParticipantTeam = 'team_a' | 'team_b' | 'unassigned';

export type MatchParticipant = {
  match_id: string;
  user_id: string;
  team: MatchParticipantTeam;
  created_at: string;
  profile?: Profile | null;
};

export type MatchRequestParticipant = {
  request_id: string;
  user_id: string;
  team: MatchParticipantTeam;
  created_at: string;
  profile?: Profile | null;
};

export type MatchRequest = {
  id: string;
  requested_by: string;
  requested_date: string;
  venue: string | null;
  note: string | null;
  status: MatchRequestStatus;
  closes_at: string | null;
  scheduled_match_id: string | null;
  created_at: string;
  updated_at: string;
  requester?: Profile | null;
};

export type MatchRequestVote = {
  request_id: string;
  user_id: string;
  vote: VoteChoice;
  created_at: string;
  updated_at: string;
  profile?: Profile | null;
};

export type Goal = {
  id: string;
  match_id: string;
  scorer_id: string;
  assist_id: string | null;
  team: 'team_a' | 'team_b' | null;
  minute: number | null;
  own_goal: boolean;
  created_at: string;
  scorer?: Profile | null;
  assist?: Profile | null;
};

export type MatchMedia = {
  id: string;
  match_id: string;
  media_type: MediaType;
  storage_bucket: string;
  storage_path: string;
  thumbnail_path: string | null;
  title: string | null;
  sort_order: number;
  duration_seconds: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type LeaderboardRowData = {
  user_id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path?: string | null;
  goals?: number;
  motm_count?: number;
  matches_played?: number;
  goals_per_match?: number;
  latest_motm_at?: string | null;
};

export type MatchComment = {
  id: string;
  match_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  profile?: Profile | null;
};
