import type {Match} from '../types/domain';

export function hasMatchPassed(match: Match, currentTime = Date.now()) {
  return new Date(match.match_date).getTime() <= currentTime;
}

export function isScheduledMatch(match: Match) {
  return match.status === 'upcoming' || (match.status as string) === 'scheduled';
}

export function isUpcomingMatch(match: Match, currentTime = Date.now()) {
  return isScheduledMatch(match) && !hasMatchPassed(match, currentTime);
}

export function isPreviousMatch(match: Match, currentTime = Date.now()) {
  return match.status === 'completed' || (isScheduledMatch(match) && hasMatchPassed(match, currentTime));
}
