import FastImage, {
  type ImageStyle,
  type ResizeMode,
} from '@d11/react-native-fast-image';
import React from 'react';
import type {StyleProp} from 'react-native';

type CachedImageProps = {
  uri: string;
  resizeMode?: ResizeMode;
  style: StyleProp<ImageStyle>;
};

export function CachedImage({
  uri,
  resizeMode = FastImage.resizeMode.cover,
  style,
}: CachedImageProps) {
  return (
    <FastImage
      resizeMode={resizeMode}
      source={{
        uri,
        cache: FastImage.cacheControl.immutable,
        priority: FastImage.priority.normal,
      }}
      style={style}
    />
  );
}
