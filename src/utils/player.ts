import type {Profile} from '../types/domain';

export function playerName(profile?: Pick<Profile, 'first_name' | 'last_name' | 'username'> | null) {
  if (!profile) {
    return 'Unknown player';
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
  return fullName || profile.username;
}
