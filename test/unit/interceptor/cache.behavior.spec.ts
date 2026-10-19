import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { CacheInterceptor } from '../../../src/interceptor/cache.interceptor';
import { CacheRemoveInterceptor } from '../../../src/interceptor/cache-remove.interceptor';

function context(request = {}, type = 'http') {
  return {
    getType: () => type,
    getHandler: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ method: 'GET', ...request }) }),
  } as any;
}

describe('Interceptor behavior', () => {
  const cache = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
  const reflector = { get: jest.fn() };
  let read: CacheInterceptor;
  let remove: CacheRemoveInterceptor;
  beforeEach(() => {
    jest.resetAllMocks();
    read = new CacheInterceptor(
      cache as any,
      reflector as unknown as Reflector,
    );
    remove = new CacheRemoveInterceptor(
      cache as any,
      reflector as unknown as Reflector,
    );
  });

  it.each([
    [{ by: 'user', name: 'id' }, { user: { id: 'u1' } }, 'u1', 'u1'],
    [
      { by: 'header', name: 'x-site' },
      { headers: { 'x-site': 's1' } },
      's1',
      's1',
    ],
    [{ by: 'param', name: 'id' }, { params: { id: 'p1' } }, 'p1', 'p1'],
    [{ by: 'query', name: 'id' }, { query: { id: 'q1' } }, 'q1', 'q1'],
    [
      { by: 'pagination', name: '' },
      { query: { limit: '20', offset: '40' } },
      '20-40',
      '*',
    ],
    [
      [
        { by: 'user', name: 'id' },
        { by: 'param', name: 'id' },
      ],
      { user: { id: 'u1' }, params: { id: 'p1' } },
      'u1-p1',
      'u1-p1',
    ],
  ])(
    'preserves read and invalidation keys for %j',
    async (by, request, readKey, deleteKey) => {
      reflector.get.mockReturnValue({ prefix: 'records', by, ttl: 250 });
      const next = { handle: jest.fn(() => of({ ok: true })) };
      expect(
        await lastValueFrom(await read.intercept(context(request), next)),
      ).toEqual({ ok: true });
      expect(cache.get).toHaveBeenCalledWith(`records-${readKey}`);
      expect(cache.set).toHaveBeenCalledWith(
        `records-${readKey}`,
        { ok: true },
        250,
      );
      expect(
        await lastValueFrom(remove.intercept(context(request), next)),
      ).toEqual({ ok: true });
      expect(cache.delete).toHaveBeenCalledWith(`records-${deleteKey}`);
    },
  );

  it.each([
    { prefix: '', by: { by: 'param', name: 'id' } },
    { prefix: 'records', by: undefined },
  ])(
    'bypasses caching when metadata has no usable key: %j',
    async (metadata) => {
      reflector.get.mockReturnValue(metadata);
      const next = { handle: jest.fn(() => of('response')) };
      expect(await lastValueFrom(await read.intercept(context(), next))).toBe(
        'response',
      );
      expect(await lastValueFrom(remove.intercept(context(), next))).toBe(
        'response',
      );
      expect(cache.get).not.toHaveBeenCalled();
      expect(cache.delete).not.toHaveBeenCalled();
    },
  );

  it('bypasses cache reads for non-HTTP calls', async () => {
    const next = { handle: jest.fn(() => of('rpc')) };
    expect(
      await lastValueFrom(await read.intercept(context({}, 'rpc'), next)),
    ).toBe('rpc');
    expect(reflector.get).not.toHaveBeenCalled();
  });

  it.each([0, false, '', null])(
    'preserves cache-miss behavior for a cached %j',
    async (value) => {
      cache.get.mockResolvedValue(value);
      reflector.get.mockReturnValue({
        prefix: 'records',
        by: { by: 'param', name: 'id' },
      });
      const next = { handle: jest.fn(() => of('fresh')) };
      expect(
        await lastValueFrom(
          await read.intercept(context({ params: { id: '1' } }), next),
        ),
      ).toBe('fresh');
      expect(cache.set).toHaveBeenCalledWith('records-1', 'fresh', 1000);
    },
  );

  it('propagates a Redis read failure before calling the handler', async () => {
    const error = new Error('read failed');
    reflector.get.mockReturnValue({
      prefix: 'records',
      by: { by: 'param', name: 'id' },
    });
    cache.get.mockRejectedValue(error);
    const next = { handle: jest.fn() };
    await expect(
      read.intercept(context({ params: { id: '1' } }), next),
    ).rejects.toBe(error);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('does not write or invalidate cache when the handler fails', async () => {
    reflector.get.mockReturnValue({
      prefix: 'records',
      by: { by: 'param', name: 'id' },
    });
    const error = new Error('handler failed');
    const next = { handle: () => throwError(() => error) };
    await expect(
      lastValueFrom(
        await read.intercept(context({ params: { id: '1' } }), next),
      ),
    ).rejects.toBe(error);
    await expect(
      lastValueFrom(remove.intercept(context({ params: { id: '1' } }), next)),
    ).rejects.toBe(error);
    expect(cache.set).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });

  it('does not await asynchronous cache writes before emitting a response', async () => {
    let finish: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    cache.set.mockReturnValue(pending);
    reflector.get.mockReturnValue({
      prefix: 'records',
      by: { by: 'param', name: 'id' },
    });
    try {
      expect(
        await lastValueFrom(
          await read.intercept(context({ params: { id: '1' } }), {
            handle: () => of('response'),
          }),
        ),
      ).toBe('response');
      expect(cache.set).toHaveBeenCalled();
    } finally {
      finish!();
      await pending;
    }
  });
});
