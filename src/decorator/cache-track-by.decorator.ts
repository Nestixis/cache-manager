import { SetMetadata } from '@nestjs/common';

export type CacheTrackByMetadata = {
  by: 'user' | 'header' | 'param' | 'pagination' | 'query';
  name: string;
};

export type CacheTrackByOptions = {
  prefix: string;
  ttl?: number;
  by: CacheTrackByMetadata | CacheTrackByMetadata[];
};

export const CACHE_TRACK_BY_KEY = 'CACHE_TRACK_BY_KEY';

export const CacheTrackBy = (options: CacheTrackByOptions): MethodDecorator =>
  SetMetadata(CACHE_TRACK_BY_KEY, options);
