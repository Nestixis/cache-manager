import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient } from 'redis';
import { CacheModule } from '../../src/cache.module';
import { CacheManager } from '../../src/manager/cache.manager';

jest.mock('redis', () => ({ createClient: jest.fn() }));
const OPTIONS = Symbol('test options');
const options = {
  redis: { host: 'redis.example', port: 6380 },
  cachePrefix: 'module:',
  defaultCacheTTL: 750,
};
@Module({
  providers: [{ provide: OPTIONS, useValue: options }],
  exports: [OPTIONS],
})
class OptionsModule {}

// The consumer relies on the default global registration of CacheModule.
@Module({
  providers: [
    {
      provide: 'CONSUMER',
      inject: [CacheManager],
      useFactory: (cache: CacheManager) => cache,
    },
  ],
  exports: ['CONSUMER'],
})
class ConsumerModule {}

describe('CacheModule registration', () => {
  const client = { connect: jest.fn(), set: jest.fn() };
  beforeEach(() => {
    jest.resetAllMocks();
    (createClient as jest.Mock).mockReturnValue(client);
    client.connect.mockResolvedValue(undefined);
  });

  it.each(['sync', 'async'])(
    'registers options and exports the manager using %s registration',
    async (mode) => {
      const registration =
        mode === 'sync'
          ? CacheModule.register(options)
          : CacheModule.registerAsync({
              imports: [OptionsModule],
              inject: [OPTIONS],
              useFactory: (value: typeof options) => value,
            });
      const module = await Test.createTestingModule({
        imports: [registration, ConsumerModule],
      }).compile();
      try {
        const manager = module.get<CacheManager>('CONSUMER');
        expect(manager).toBe(module.get(CacheManager));
        expect(createClient).toHaveBeenCalledWith({
          url: 'redis://redis.example:6380',
        });
        expect(client.connect).toHaveBeenCalledTimes(1);
        await manager.set('key', 'value');
        expect(client.set).toHaveBeenCalledWith('module:key', 'value', {
          PX: 750,
        });
      } finally {
        await module.close();
      }
    },
  );

  it('allows disabling global registration', () => {
    expect(CacheModule.register({ ...options, isGlobal: false }).global).toBe(
      false,
    );
  });

  it('rejects module creation when Redis cannot connect', async () => {
    const error = new Error('connection refused');
    client.connect.mockRejectedValue(error);
    await expect(
      Test.createTestingModule({
        imports: [CacheModule.register(options)],
      }).compile(),
    ).rejects.toBe(error);
  });
});
