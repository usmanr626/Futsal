import {RouteProp, useRoute} from '@react-navigation/native';
import React, {useEffect, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import Video from 'react-native-video';

import {AppText} from '../../components/ui/AppText';
import {CachedImage} from '../../components/ui/CachedImage';
import {EmptyState} from '../../components/ui/EmptyState';
import {Screen} from '../../components/ui/Screen';
import {supabase} from '../../config/supabase';
import {getSignedMediaUrl} from '../../services/mediaService';
import {colors, spacing} from '../../theme/theme';
import type {MatchMedia} from '../../types/domain';
import type {RootStackParamList} from '../../types/navigation';
import {formatDateTime} from '../../utils/date';

type Route = RouteProp<RootStackParamList, 'MediaViewer'>;

export function MediaViewerScreen() {
  const route = useRoute<Route>();
  const [media, setMedia] = useState<MatchMedia | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const {data, error} = await supabase
          .from('match_media')
          .select('*')
          .eq('id', route.params.mediaId)
          .single();

        if (error) {
          throw error;
        }

        const mediaRow = data as MatchMedia;
        setMedia(mediaRow);

        const signed = await getSignedMediaUrl(mediaRow);
        if (!signed.allowed) {
          setBlockedUntil(signed.nextAvailableAt);
          return;
        }

        setUrl(signed.url);
      } catch (error) {
        Alert.alert('Media error', error instanceof Error ? error.message : 'Try again.');
      }
    }

    load();
  }, [route.params.mediaId]);

  return (
    <Screen scroll={false}>
      <View style={styles.wrap}>
        {blockedUntil ? (
          <EmptyState
            title="Video locked"
            body={`You can watch this again after ${formatDateTime(blockedUntil)}.`}
          />
        ) : !url || !media ? (
          <EmptyState title="Loading media" />
        ) : media.media_type === 'photo' ? (
          <CachedImage uri={url} resizeMode="contain" style={styles.media} />
        ) : (
          <Video
            controls
            resizeMode="contain"
            source={{uri: url}}
            style={styles.media}
          />
        )}
        <AppText variant="label" muted style={styles.label}>
          {media?.media_type ?? route.params.mediaType}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  media: {
    backgroundColor: colors.black,
    borderRadius: 8,
    flex: 1,
    width: '100%',
  },
  label: {
    textAlign: 'center',
  },
});
