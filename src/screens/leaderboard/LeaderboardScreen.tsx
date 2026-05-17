import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';

import {LeaderboardRow} from '../../components/leaderboard/LeaderboardRow';
import {AppText} from '../../components/ui/AppText';
import {Card} from '../../components/ui/Card';
import {EmptyState} from '../../components/ui/EmptyState';
import {Screen} from '../../components/ui/Screen';
import {SegmentedControl} from '../../components/ui/SegmentedControl';
import {fetchFunAwards, fetchLeaderboard} from '../../services/matchService';
import {colors, spacing} from '../../theme/theme';
import type {FunAward, LeaderboardRowData} from '../../types/domain';
import type {RootStackParamList} from '../../types/navigation';

type Tab = 'goals' | 'motm' | 'appearances';
type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function LeaderboardScreen() {
  const navigation = useNavigation<Navigation>();
  const [tab, setTab] = useState<Tab>('goals');
  const [rows, setRows] = useState<LeaderboardRowData[]>([]);
  const [awards, setAwards] = useState<FunAward[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [leaderboardRows, awardRows] = await Promise.all([
        fetchLeaderboard(tab),
        fetchFunAwards(),
      ]);
      setRows(leaderboardRows);
      setAwards(awardRows);
    } catch (error) {
      Alert.alert('Load error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const metric = (row: LeaderboardRowData) => {
    if (tab === 'goals') {
      return {label: 'Goals', value: row.goals ?? 0};
    }
    if (tab === 'motm') {
      return {label: 'MOTM', value: row.motm_count ?? 0};
    }
    return {label: 'Apps', value: row.matches_played ?? 0};
  };

  return (
    <Screen>
      <AppText variant="title">Leaderboard</AppText>
      <AppText muted style={styles.copy}>
        All-time rankings for the group.
      </AppText>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          {label: 'Goals', value: 'goals'},
          {label: 'MOTM', value: 'motm'},
          {label: 'Apps', value: 'appearances'},
        ]}
      />

      <View style={styles.list}>
        {rows.length ? (
          rows.map((row, index) => {
            const rowMetric = metric(row);
            return (
              <LeaderboardRow
                key={row.user_id}
                row={row}
                rank={index + 1}
                metricLabel={rowMetric.label}
                metricValue={rowMetric.value}
                onPress={() =>
                  navigation.navigate('UserProfile', {userId: row.user_id})
                }
              />
            );
          })
        ) : (
          <EmptyState
            title={loading ? 'Loading...' : 'No stats yet'}
            body="Stats appear after admins add match results."
          />
        )}
      </View>

      <View style={styles.awardsSection}>
        <AppText variant="heading">Fun badges</AppText>
        <View style={styles.awardsGrid}>
          {awards.map(award => (
            <Card key={award.id} style={styles.awardCard}>
              <View style={styles.badgeDot} />
              <AppText variant="label" muted>
                {award.title}
              </AppText>
              <AppText>{award.winner}</AppText>
              <AppText variant="small" muted>
                {award.detail}
              </AppText>
            </Card>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: {
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  awardsSection: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  awardsGrid: {
    gap: spacing.md,
  },
  awardCard: {
    gap: spacing.xs,
  },
  badgeDot: {
    backgroundColor: colors.primaryAlt,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
});
