import {decode} from 'base64-arraybuffer';
import type {Asset} from 'react-native-image-picker';

import {supabase} from '../config/supabase';
import type {Profile} from '../types/domain';

const AVATAR_SIGNED_URL_SECONDS = 60 * 60;
const AVATAR_CACHE_BUFFER_MS = 60 * 1000;
const avatarUrlCache = new Map<string, {url: string; expiresAt: number}>();
const SUPPORTED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function getAvatarUrl(path: string) {
  const cached = avatarUrlCache.get(path);

  if (cached && cached.expiresAt > Date.now() + AVATAR_CACHE_BUFFER_MS) {
    return cached.url;
  }

  const {data, error} = await supabase.storage
    .from('avatars')
    .createSignedUrl(path, AVATAR_SIGNED_URL_SECONDS);

  if (error) {
    throw error;
  }

  avatarUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + AVATAR_SIGNED_URL_SECONDS * 1000,
  });

  return data.signedUrl;
}

export async function fetchProfileById(userId: string) {
  const {data, error} = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Profile | null;
}

export async function uploadAvatar(options: {userId: string; asset: Asset}) {
  if (!options.asset.base64) {
    throw new Error('Could not read selected image data. Please choose another photo.');
  }

  const contentType = normalizeAvatarContentType(options.asset.type);
  const extension = extensionForContentType(contentType);
  const path = `${options.userId}/avatar-${Date.now()}.${extension}`;
  const fileBody = decode(options.asset.base64);

  const {error} = await supabase.storage.from('avatars').upload(path, fileBody, {
    contentType: options.asset.type || 'image/jpeg',
    upsert: true,
  });

  if (error) {
    throw error;
  }

  avatarUrlCache.delete(path);

  return path;
}

function normalizeAvatarContentType(type: string | undefined) {
  if (!type) {
    return 'image/jpeg';
  }

  const normalizedType = type.toLowerCase();

  if (normalizedType === 'image/jpg') {
    return 'image/jpeg';
  }

  if (SUPPORTED_AVATAR_TYPES.has(normalizedType)) {
    return normalizedType;
  }

  return 'image/jpeg';
}

function extensionForContentType(type: string) {
  if (type === 'image/png') {
    return 'png';
  }

  if (type === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}
