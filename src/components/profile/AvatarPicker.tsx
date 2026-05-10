import {Camera} from 'lucide-react-native';
import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {uploadAvatar} from '../../services/profileService';
import {colors, spacing} from '../../theme/theme';
import type {Profile} from '../../types/domain';
import {isWithinLast24Hours, next24HourReset} from '../../utils/rateLimits';
import {AppText} from '../ui/AppText';
import {ProfileAvatar} from './ProfileAvatar';

type AvatarPickerProps = {
  profile: Profile | null;
  isAdmin: boolean;
  onAvatarPathChange: (path: string) => Promise<void>;
};

export function AvatarPicker({
  profile,
  isAdmin,
  onAvatarPathChange,
}: AvatarPickerProps) {
  const [loading, setLoading] = useState(false);

  const pickAvatar = async () => {
    if (!profile) {
      return;
    }

    if (!isAdmin && isWithinLast24Hours(profile.avatar_updated_at)) {
      Alert.alert(
        'Tiny free-app budget',
        `Fresh look locked in. To keep this free for the squad, profile photos can only be changed once every 24 hours. Try again after ${next24HourReset(
          profile.avatar_updated_at!,
        ).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}.`,
      );
      return;
    }

    const result = await launchImageLibrary({
      includeBase64: true,
      maxHeight: 512,
      maxWidth: 512,
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.errorMessage) {
      Alert.alert('Photo error', result.errorMessage);
      return;
    }

    const asset = result.assets?.[0];
    if (!asset) {
      return;
    }

    try {
      setLoading(true);
      const path = await uploadAvatar({userId: profile.id, asset});
      await onAvatarPathChange(path);
    } catch (error) {
      Alert.alert(
        'Photo error',
        error instanceof Error ? error.message : 'Could not upload profile photo.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable onPress={pickAvatar} style={styles.wrap}>
      <ProfileAvatar profile={profile} size={84} style={styles.uploadedAvatar} />
      <View style={styles.action}>
        <Camera color={colors.primaryAlt} size={16} />
        <AppText variant="small">
          {loading ? 'Uploading...' : 'Profile photo'}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadedAvatar: {
    backgroundColor: colors.black,
  },
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
