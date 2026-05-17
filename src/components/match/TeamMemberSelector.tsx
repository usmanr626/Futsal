import React from 'react';
import {StyleSheet, View} from 'react-native';

import {spacing} from '../../theme/theme';
import type {PlayerStatSummary, Profile} from '../../types/domain';
import {AppText} from '../ui/AppText';
import {PlayerChips} from './PlayerChips';

type TeamMemberSelectorProps = {
  profiles: Profile[];
  teamAName: string;
  teamAUserIds: string[];
  teamBName: string;
  teamBUserIds: string[];
  statsByUserId?: Record<string, PlayerStatSummary>;
  onChange: (next: {teamAUserIds: string[]; teamBUserIds: string[]}) => void;
};

export function TeamMemberSelector({
  profiles,
  teamAName,
  teamAUserIds,
  teamBName,
  teamBUserIds,
  statsByUserId,
  onChange,
}: TeamMemberSelectorProps) {
  const toggleTeam = (userId: string, team: 'team_a' | 'team_b') => {
    const fromA = teamAUserIds.includes(userId);
    const fromB = teamBUserIds.includes(userId);

    if (team === 'team_a') {
      onChange({
        teamAUserIds: fromA
          ? teamAUserIds.filter(id => id !== userId)
          : [...teamAUserIds, userId],
        teamBUserIds: fromB
          ? teamBUserIds.filter(id => id !== userId)
          : teamBUserIds,
      });
      return;
    }

    onChange({
      teamAUserIds: fromA
        ? teamAUserIds.filter(id => id !== userId)
        : teamAUserIds,
      teamBUserIds: fromB
        ? teamBUserIds.filter(id => id !== userId)
        : [...teamBUserIds, userId],
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.section}>
        <AppText variant="label" muted>
          {teamAName || 'Team A'} players
        </AppText>
        <PlayerChips
          profiles={profiles}
          selectedIds={teamAUserIds}
          statsByUserId={statsByUserId}
          onToggle={profileId => toggleTeam(profileId, 'team_a')}
        />
      </View>

      <View style={styles.section}>
        <AppText variant="label" muted>
          {teamBName || 'Team B'} players
        </AppText>
        <PlayerChips
          profiles={profiles}
          selectedIds={teamBUserIds}
          statsByUserId={statsByUserId}
          onToggle={profileId => toggleTeam(profileId, 'team_b')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
});
