import {RouteProp, useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Play} from 'lucide-react-native';
import React, {useCallback, useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '../../components/ui/AppText';
import {CachedImage} from '../../components/ui/CachedImage';
import {EmptyState} from '../../components/ui/EmptyState';
import {Screen} from '../../components/ui/Screen';
import {getPhotoPreviewUrl} from '../../services/mediaService';
import {fetchMatch, fetchMedia} from '../../services/matchService';
import {colors, radius, spacing} from '../../theme/theme';
import type {Match, MatchMedia} from '../../types/domain';
import type {RootStackParamList} from '../../types/navigation';
import {formatDateTime} from '../../utils/date';

type Route = RouteProp<RootStackParamList, 'MatchGallery'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function MatchGalleryScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Navigation>();
  const [match, setMatch] = useState<Match | null>(null);
  const [media, setMedia] = useState<MatchMedia[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [matchRow, mediaRows] = await Promise.all([
        fetchMatch(route.params.matchId),
        fetchMedia(route.params.matchId),
      ]);

      const previews: Record<string, string> = {};
      await Promise.all(
        mediaRows.map(async item => {
          const url = await getPhotoPreviewUrl(item);
          if (url) {
            previews[item.id] = url;
          }
        }),
      );

      setMatch(matchRow);
      setMedia(mediaRows);
      setPhotoUrls(previews);
    } catch (error) {
      Alert.alert('Gallery error', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, [route.params.matchId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openMedia = (item: MatchMedia) => {
    navigation.navigate('MediaViewer', {
      mediaId: item.id,
      mediaType: item.media_type,
    });
  };

  if (loading) {
    return (
      <Screen>
        <EmptyState title="Loading gallery" />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">{match?.title ?? 'Gallery'}</AppText>
        {match ? (
          <AppText muted>{formatDateTime(match.match_date)}</AppText>
        ) : null}
      </View>

      {media.length ? (
        <View style={styles.grid}>
          {media.map((item, index) => {
            const photoUrl = photoUrls[item.id];
            const featured = index === 0 && item.media_type === 'photo';

            return (
              <Pressable
                key={item.id}
                onPress={() => openMedia(item)}
                style={[styles.tile, featured && styles.featuredTile]}>
                {item.media_type === 'photo' && photoUrl ? (
                  <CachedImage uri={photoUrl} style={styles.image} />
                ) : (
                  <View style={styles.videoTile}>
                    <Play color={colors.white} fill={colors.white} size={32} />
                    <AppText variant="label" style={styles.videoText}>
                      Video
                    </AppText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <EmptyState title="No media yet" body="Photos and videos will appear here." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    aspectRatio: 1,
    backgroundColor: colors.black,
    borderRadius: radius.md,
    overflow: 'hidden',
    width: '48.5%',
  },
  featuredTile: {
    aspectRatio: 1.25,
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  videoTile: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  videoText: {
    color: colors.white,
  },
});
