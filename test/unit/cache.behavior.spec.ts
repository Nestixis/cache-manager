import { CacheManager } from '../../src/manager/cache.manager';

describe('CacheManager behavior', () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
  };
  let manager: CacheManager;

  beforeEach(() => {
    jest.resetAllMocks();
    manager = new CacheManager(redis as any, {
      redis: { host: 'localhost', port: 6379 },
    });
  });

  it.each(['', 'user:*'])('ignores invalid read key %j', async (key) => {
    expect(await manager.get(key)).toBeUndefined();
    expect(redis.get).not.toHaveBeenCalled();
  });

  it.each([
    ['plain text', 'plain text'],
    ['{"id":1}', { id: 1 }],
    ['false', false],
    ['0', 0],
    [null, null],
  ])('preserves the existing read result for %j', async (value, expected) => {
    redis.get.mockResolvedValue(value);
    expect(await manager.get('key')).toEqual(expected);
    expect(redis.get).toHaveBeenCalledWith('cache:key');
  });

  it.each([
    [undefined, 1000],
    [250, 250],
    [0, undefined],
    [-1, undefined],
  ])('preserves TTL %j as %j milliseconds', async (ttl, expected) => {
    await manager.set('key', 'value', ttl);
    expect(redis.set).toHaveBeenCalledWith('cache:key', 'value', {
      PX: expected,
    });
  });

  it('serializes objects using the configured prefix', async () => {
    manager = new CacheManager(redis as any, {
      redis: { host: 'localhost', port: 6379 },
      cachePrefix: 'custom:',
      defaultCacheTTL: 5000,
    });
    await manager.set('key', { id: 1 });
    expect(redis.set).toHaveBeenCalledWith('custom:key', '{"id":1}', {
      PX: 5000,
    });
  });

  it('deletes matching wildcard keys', async () => {
    redis.keys.mockResolvedValue(['cache:user:1', 'cache:user:2']);
    await manager.delete('user:*');
    expect(redis.keys).toHaveBeenCalledWith('cache:user:*');
    expect(redis.del).toHaveBeenCalledWith(['cache:user:1', 'cache:user:2']);
  });

  it.each(['delete', 'purge'])(
    'does not call DEL when %s finds no matching keys',
    async (method) => {
      redis.keys.mockResolvedValue([]);
      if (method === 'delete') await manager.delete('user:*');
      else await manager.purge('user:');
      expect(redis.del).not.toHaveBeenCalled();
    },
  );

  it.each(['get', 'set', 'delete', 'purge'])(
    'propagates Redis failures from %s',
    async (method) => {
      const error = new Error('Redis unavailable');
      if (method === 'get') redis.get.mockRejectedValue(error);
      if (method === 'set') redis.set.mockRejectedValue(error);
      if (method === 'delete') redis.del.mockRejectedValue(error);
      if (method === 'purge') redis.keys.mockRejectedValue(error);
      const operation =
        method === 'get'
          ? manager.get('key')
          : method === 'set'
            ? manager.set('key', 'value')
            : method === 'delete'
              ? manager.delete('key')
              : manager.purge();
      await expect(operation).rejects.toBe(error);
    },
  );
});
