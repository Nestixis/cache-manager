import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface CacheModuleOptions {
  redis: {
    host: string;
    port: number;
  };

  cachePrefix?: string;

  defaultCacheTTL?: number;
}

export const {
  MODULE_OPTIONS_TOKEN: CACHE_MODULE_OPTIONS,
  ConfigurableModuleClass,
} = new ConfigurableModuleBuilder<CacheModuleOptions>()
  .setExtras(
    {
      isGlobal: true,
    },
    (definition, extras) => {
      return {
        ...definition,
        global: extras.isGlobal,
      };
    },
  )
  .build();
