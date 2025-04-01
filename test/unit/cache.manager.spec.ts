import { Test, TestingModule } from '@nestjs/testing';
import { CacheManager } from '../../src/manager/cache.manager';
import { RedisClientType } from '@redis/client';
import { CACHE_MODULE_OPTIONS } from '../../src/cache.module-definition';

describe('CacheManager ', () => {
  let cacheManager: CacheManager;
  let redisClientMock: jest.Mocked<RedisClientType>;

  beforeEach(async () => {
    redisClientMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    } as unknown as jest.Mocked<RedisClientType>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheManager,
        {
          provide: 'CACHE_REDIS_CLIENT',
          useValue: redisClientMock,
        },
        {
          provide: CACHE_MODULE_OPTIONS,
          useValue: { cachePrefix: 'test:', defaultCacheTTL: 5000 },
        },
      ],
    }).compile();

    cacheManager = module.get<CacheManager>(CacheManager);
  });

  it('should retrieve a value from the cache', async () => {
    redisClientMock.get.mockResolvedValueOnce('{"key":"value"}');
    const result = await cacheManager.get('testKey');
    expect(redisClientMock.get).toHaveBeenCalledWith('test:testKey');
    expect(result).toEqual({ key: 'value' });
  });

  it('should store a value in the cache with default TTL', async () => {
    await cacheManager.set('testKey', { key: 'value' });
    expect(redisClientMock.set).toHaveBeenCalledWith(
      'test:testKey',
      JSON.stringify({ key: 'value' }),
      { PX: 5000 },
    );
  });

  it('should delete a specific cache key', async () => {
    await cacheManager.delete('testKey');
    expect(redisClientMock.del).toHaveBeenCalledWith('test:testKey');
  });

  it('should purge all keys with the cache prefix', async () => {
    redisClientMock.keys.mockResolvedValueOnce(['test:key1', 'test:key2']);
    await cacheManager.purge();
    expect(redisClientMock.keys).toHaveBeenCalledWith('test:*');
    expect(redisClientMock.del).toHaveBeenCalledWith([
      'test:key1',
      'test:key2',
    ]);
  });

  it('should purge keys with a specific prefix', async () => {
    redisClientMock.keys.mockResolvedValueOnce([
      'test:prefix1',
      'test:prefix2',
    ]);
    await cacheManager.purge('prefix');
    expect(redisClientMock.keys).toHaveBeenCalledWith('test:prefix*');
    expect(redisClientMock.del).toHaveBeenCalledWith([
      'test:prefix1',
      'test:prefix2',
    ]);
  });
});
