import React, {useEffect, useState} from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';

import {getAvatarUrl} from '../../services/profileService';
import {colors, radius} from '../../theme/theme';
import type {Profile} from '../../types/domain';
import {AppText} from '../ui/AppText';
import {CachedImage} from '../ui/CachedImage';

type ProfileAvatarProps = {
  profile?: Pick<Profile, 'first_name' | 'username'> & {
    avatar_path?: string | null;
  } | null;
  size?: number;
  style?: ViewStyle;
};

export function ProfileAvatar({profile, size = 44, style}: ProfileAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAvatar() {
      if (!profile?.avatar_path) {
        setAvatarUrl(null);
        return;
      }

      try {
        const url = await getAvatarUrl(profile.avatar_path);
        if (mounted) {
          setAvatarUrl(url);
        }
      } catch {
        if (mounted) {
          setAvatarUrl(null);
        }
      }
    }

    loadAvatar();

    return () => {
      mounted = false;
    };
  }, [profile?.avatar_path]);

  const initial = (profile?.first_name || profile?.username || 'P')[0].toUpperCase();

  return (
    <View
      style={[
        styles.avatar,
        {borderRadius: Math.min(radius.md, size / 4), height: size, width: size},
        style,
      ]}>
      {avatarUrl ? (
        <CachedImage uri={avatarUrl} style={styles.image} />
      ) : (
        <AppText variant="heading" style={styles.initial}>
          {initial}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  initial: {
    color: colors.onPrimary,
  },
});
