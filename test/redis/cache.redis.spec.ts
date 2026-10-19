import { randomUUID } from 'crypto';
import { createClient } from 'redis';
import { CacheManager } from '../../src/manager/cache.manager';

describe('CacheManager with real Redis', () => {
  const client = createClient({
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    socket: { connectTimeout: 1000, reconnectStrategy: false },
  });
  const cachePrefix = `cache-manager-test:${randomUUID()}:`;
  const manager = new CacheManager(client as any, {
    redis: { host: 'localhost', port: 6379 },
    cachePrefix,
  });
  client.on('error', () => {
    /* Command promises report connection failures. */
  });
  beforeAll(async () => {
    await client.connect();
  });
  afterAll(async () => {
    if (client.isReady) {
      try {
        await manager.purge();
      } finally {
        await client.quit();
      }
    } else if (client.isOpen) {
      await client.disconnect();
    }
  });

  it('round-trips JSON, invalidates a wildcard and isolates namespaces', async () => {
    await manager.set('records:1', { id: 1 }, 0);
    await manager.set('records:2', { id: 2 }, -1);
    await manager.set('other', 'keep', 0);
    expect(await manager.get('records:1')).toEqual({ id: 1 });
    expect(await client.pTTL(`${cachePrefix}records:1`)).toBe(-1);
    expect(await client.pTTL(`${cachePrefix}records:2`)).toBe(-1);
    await manager.delete('records:*');
    expect(await manager.get('records:1')).toBeNull();
    expect(await manager.get('records:2')).toBeNull();
    expect(await manager.get('other')).toBe('keep');
    await manager.purge();
    expect(await manager.get('other')).toBeNull();
  });

  it('expires a key using millisecond TTL', async () => {
    await manager.set('expiring', 'value', 200);
    expect(await manager.get('expiring')).toBe('value');
    const deadline = Date.now() + 3000;
    while (
      Date.now() < deadline &&
      (await client.exists(`${cachePrefix}expiring`))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(await manager.get('expiring')).toBeNull();
  });
});
