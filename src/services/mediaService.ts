import {decode} from 'base64-arraybuffer';
import type {Asset} from 'react-native-image-picker';
import ReactNativeBlobUtil from 'react-native-blob-util';

import {supabase} from '../config/supabase';
import type {MatchMedia, ReactionType} from '../types/domain';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const PHOTO_SIGNED_URL_SECONDS = 60 * 60;
const PHOTO_SIGNED_URL_CACHE_BUFFER_MS = 60 * 1000;
const photoSignedUrlCache = new Map<
  string,
  {url: string; expiresAt: number}
>();

async function getAssetUploadBody(asset: Asset) {
  if (asset.base64) {
    return decode(asset.base64);
  }

  if (!asset.uri) {
    throw new Error('Missing asset URI');
  }

  try {
    const base64 = await ReactNativeBlobUtil.fs.readFile(asset.uri, 'base64');
    return decode(base64);
  } catch (error) {
    if (asset.uri.startsWith('file://')) {
      const base64 = await ReactNativeBlobUtil.fs.readFile(
        asset.uri.replace('file://', ''),
        'base64',
      );
      return decode(base64);
    }

    throw error;
  }
}

async function getCachedPhotoSignedUrl(media: MatchMedia) {
  const key = `${media.storage_bucket}/${media.storage_path}`;
  const cached = photoSignedUrlCache.get(key);

  if (cached && cached.expiresAt > Date.now() + PHOTO_SIGNED_URL_CACHE_BUFFER_MS) {
    return cached.url;
  }

  const {data, error} = await supabase.storage
    .from(media.storage_bucket)
    .createSignedUrl(media.storage_path, PHOTO_SIGNED_URL_SECONDS);

  if (error) {
    throw error;
  }

  photoSignedUrlCache.set(key, {
    url: data.signedUrl,
    expiresAt: Date.now() + PHOTO_SIGNED_URL_SECONDS * 1000,
  });

  return data.signedUrl;
}

export async function toggleReaction(mediaId: string, userId: string, reaction: ReactionType) {
  const {data: existing, error: readError} = await supabase
    .from('media_reactions')
    .select('reaction')
    .eq('media_id', mediaId)
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (existing?.reaction === reaction) {
    const {error} = await supabase
      .from('media_reactions')
      .delete()
      .eq('media_id', mediaId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return;
  }

  const {error} = await supabase.from('media_reactions').upsert({
    media_id: mediaId,
    user_id: userId,
    reaction,
  });

  if (error) {
    throw error;
  }
}

export async function getSignedMediaUrl(media: MatchMedia) {
  if (media.media_type === 'photo') {
    return {
      allowed: true,
      nextAvailableAt: null,
      url: await getCachedPhotoSignedUrl(media),
    };
  }

  if (media.media_type === 'video') {
    const {data: claim, error: claimError} = await supabase.rpc('claim_video_view', {
      p_media_id: media.id,
    });

    if (claimError) {
      throw claimError;
    }

    const result = Array.isArray(claim) ? claim[0] : claim;
    if (!result?.allowed) {
      return {
        allowed: false,
        nextAvailableAt: result?.next_available_at as string | null,
        url: null,
      };
    }
  }

  const {data, error} = await supabase.storage
    .from(media.storage_bucket)
    .createSignedUrl(media.storage_path, 60 * 15);

  if (error) {
    throw error;
  }

  return {
    allowed: true,
    nextAvailableAt: null,
    url: data.signedUrl,
  };
}

export async function getPhotoPreviewUrl(media: MatchMedia) {
  if (media.media_type !== 'photo') {
    return null;
  }

  return getCachedPhotoSignedUrl(media);
}

export async function uploadMatchAsset(options: {
  matchId: string;
  asset: Asset;
  type: 'photo' | 'video';
  uploadedBy: string;
}) {
  const maxBytes = options.type === 'photo' ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;

  if (options.asset.fileSize && options.asset.fileSize > maxBytes) {
    throw new Error(
      options.type === 'photo'
        ? 'Photo is too large. Please choose an image under 5 MB.'
        : 'Video is too large for the free-tier setup. Please choose a video under 50 MB.',
    );
  }

  const bucket = options.type === 'photo' ? 'match-photos' : 'match-videos';
  const extension =
    options.asset.fileName?.split('.').pop() ||
    (options.type === 'photo' ? 'jpg' : 'mp4');
  const path = `${options.matchId}/${Date.now()}.${extension}`;
  const fileBody = await getAssetUploadBody(options.asset);

  const {error: uploadError} = await supabase.storage.from(bucket).upload(path, fileBody, {
    contentType:
      options.asset.type ||
      (options.type === 'photo' ? 'image/jpeg' : 'video/mp4'),
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const {error: rowError} = await supabase.from('match_media').insert({
    match_id: options.matchId,
    media_type: options.type,
    storage_bucket: bucket,
    storage_path: path,
    uploaded_by: options.uploadedBy,
  });

  if (rowError) {
    throw rowError;
  }
}
