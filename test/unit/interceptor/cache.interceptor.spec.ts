import { CacheInterceptor } from '../../../src/interceptor/cache.interceptor';
import { CacheManager } from '../../../src/manager/cache.manager';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

describe('CacheInterceptor', () => {
  let cacheInterceptor: CacheInterceptor;
  let cacheManagerMock: jest.Mocked<CacheManager>;
  let reflectorMock: jest.Mocked<Reflector>;

  beforeEach(() => {
    cacheManagerMock = {
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<CacheManager>;

    reflectorMock = {
      get: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    cacheInterceptor = new CacheInterceptor(cacheManagerMock, reflectorMock);
  });

  it('should bypass caching for non-GET methods', async () => {
    const contextMock = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ method: 'POST' }),
      }),
    } as any;

    const nextMock = { handle: jest.fn().mockReturnValue(of('response')) };

    const result = await cacheInterceptor.intercept(contextMock, nextMock);
    expect(result).toBeInstanceOf(Object);
    expect(nextMock.handle).toHaveBeenCalled();
    expect(cacheManagerMock.get).not.toHaveBeenCalled();
  });

  it('should return cached value if available', async () => {
    cacheManagerMock.get.mockResolvedValueOnce('cachedValue');
    reflectorMock.get.mockReturnValue({
      prefix: 'test',
      by: { by: 'param', name: 'id' },
      ttl: 1000,
    });

    const contextMock = {
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest
          .fn()
          .mockReturnValue({ method: 'GET', params: { id: '123' } }),
      }),
    } as any;

    const nextMock = { handle: jest.fn() };

    const result = await cacheInterceptor.intercept(contextMock, nextMock);
    const cachedValue = await lastValueFrom(result);
    expect(cachedValue).toEqual('cachedValue');
    expect(cacheManagerMock.get).toHaveBeenCalledWith('test-123');
    expect(nextMock.handle).not.toHaveBeenCalled();
  });

  it('should cache response if no cached value exists', async () => {
    cacheManagerMock.get.mockResolvedValueOnce(undefined);
    reflectorMock.get.mockReturnValue({
      prefix: 'test',
      by: { by: 'param', name: 'id' },
      ttl: 1000,
    });

    const contextMock = {
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest
          .fn()
          .mockReturnValue({ method: 'GET', params: { id: '123' } }),
      }),
    } as any;

    const nextMock = { handle: jest.fn().mockReturnValue(of('response')) };

    const result = await cacheInterceptor.intercept(contextMock, nextMock);
    const response = await lastValueFrom(result); // Ensure the observable is resolved
    expect(response).toEqual('response'); // Verify the response is correct
    expect(cacheManagerMock.get).toHaveBeenCalledWith('test-123');
    expect(cacheManagerMock.set).toHaveBeenCalledWith(
      'test-123',
      'response',
      1000,
    );
  });
});
