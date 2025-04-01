import { CacheRemoveInterceptor } from '../../../src/interceptor/cache-remove.interceptor';
import { CacheManager } from '../../../src/manager/cache.manager';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

describe('CacheRemoveInterceptor', () => {
  let cacheRemoveInterceptor: CacheRemoveInterceptor;
  let cacheManagerMock: jest.Mocked<CacheManager>;
  let reflectorMock: jest.Mocked<Reflector>;

  beforeEach(() => {
    cacheManagerMock = {
      delete: jest.fn(),
    } as unknown as jest.Mocked<CacheManager>;

    reflectorMock = {
      get: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    cacheRemoveInterceptor = new CacheRemoveInterceptor(
      cacheManagerMock,
      reflectorMock,
    );
  });

  it('should bypass cache removal for non-HTTP contexts', () => {
    const contextMock = { getType: jest.fn().mockReturnValue('rpc') } as any;
    const nextMock = { handle: jest.fn().mockReturnValue(of('response')) };

    const result = cacheRemoveInterceptor.intercept(contextMock, nextMock);
    expect(result).toBeInstanceOf(Object);
    expect(nextMock.handle).toHaveBeenCalled();
    expect(cacheManagerMock.delete).not.toHaveBeenCalled();
  });

  it('should remove cache entry based on metadata', async () => {
    reflectorMock.get.mockReturnValue({
      prefix: 'test',
      by: { by: 'param', name: 'id' },
    });

    const contextMock = {
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ params: { id: '123' } }),
      }),
    } as any;

    const nextMock = { handle: jest.fn().mockReturnValue(of('response')) };

    const result = await lastValueFrom(
      cacheRemoveInterceptor.intercept(contextMock, nextMock),
    );
    expect(result).toBe('response');
    expect(nextMock.handle).toHaveBeenCalled();
    expect(cacheManagerMock.delete).toHaveBeenCalledWith('test-123');
  });
});
