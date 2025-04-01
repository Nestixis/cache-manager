# Cache Manager

Cache Manager is a lightweight and efficient library for managing redis caching in your applications.

## Features

- Simple API for adding, retrieving, and deleting cache entries.
- Configurable expiration policies for cached items.
- Supports redis
- Lightweight and fast.

## Installation

Install the package using npm

```sh
npm i @nestixis/cache-manager
```

## Usage

Here’s a quick example of how to use Cache Manager:

Module registration

```ts
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: +configService.get('REDIS_PORT') || 6379,
        },
        cachePrefix: 'cache:',
        defaultCacheTTL: 1000,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

Manual interaction with CacheManager

```ts
export class Service {
  constructor(private readonly cacheManager: CacheManager) {}

  async add(): Promise<void> {
    //...
    await this.cacheManager.add('key', { value: 1 }, 1000);
  }

  async remove(): Promise<void> {
    //...
    await this.cacheManager.remove('key');
  }

  async get(): Promise<any> {
    const cached = await this.cacheManager.get('key');
    if (cached) return cached;
  }
}
```

Automatic response caching. There are two interceptors first

- CacheInterceptor - saves response for time defined by ttl.

- CacheRemoveInterceptor - removes cache, can be used on POST, DELETE, PUT, PATCH methods. It ensures that cache will be removed.

```ts
@Controller('site/:token')
@CacheTrackBy({
  prefix: 'site'
  ttl: 10000,
  by: [
    {
      by: 'param',
      name: 'token',
    }
  ]
})
export class SiteController {
  constructor(
    private readonly service: Service
  )

  @Get()
  @UseInterceptors(CacheInterceptor)
  async get(): Promise<any> {
    return this.service.get();
  }

  @Post()
  @UseInterceptors(CacheRemoveInterceptor)
  async add(): Promise<void> {
    await this.service.add();
  }

  @Delete()
  @UseInterceptors(CacheRemoveInterceptor)
  async remove(): Promise<void> {
    await this.service.remove();
  }
}
```
