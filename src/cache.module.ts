import { Module } from '@nestjs/common';
import {
  CACHE_MODULE_OPTIONS,
  CacheModuleOptions,
  ConfigurableModuleClass,
} from './cache.module-definition';
import { CacheManager } from './manager/cache.manager';

@Module({
  providers: [
    {
      provide: 'CACHE_REDIS_CLIENT',
      useFactory: async (options: CacheModuleOptions) => {
        const { createClient } = await import('redis');
        const client = createClient({
          url: `redis://${options.redis.host}:${options.redis.port}`,
        });
        await client.connect();
        return client;
      },
      inject: [CACHE_MODULE_OPTIONS],
    },

    CacheManager,
  ],
  exports: [CacheManager],
})
export class CacheModule extends ConfigurableModuleClass {}
