import { Inject, Injectable } from '@nestjs/common';
import { RedisClientType } from '@redis/client';
import {
  CACHE_MODULE_OPTIONS,
  CacheModuleOptions,
} from '../cache.module-definition';

@Injectable()
export class CacheManager {
  private readonly cachePrefix: string;
  private readonly defaultCacheTTL: number;

  constructor(
    @Inject('CACHE_REDIS_CLIENT')
    private readonly redisClient: RedisClientType,
    @Inject(CACHE_MODULE_OPTIONS)
    private readonly options: CacheModuleOptions,
  ) {
    this.cachePrefix = options.cachePrefix ?? 'cache:';
    this.defaultCacheTTL = options.defaultCacheTTL ?? 1000;
  }

  /**
   * Retrieves a value from the cache by its key.
   *
   * @param key - The key associated with the cached value. Must not be empty or contain '*'.
   * @returns A promise that resolves to the cached value, which can be a string or an object.
   *          If the key is invalid or not found, it resolves to `undefined`.
   *          If the cached value is a JSON string, it will be parsed into an object.
   *          Otherwise, the raw string value is returned.
   * @throws Will not throw an error if JSON parsing fails; instead, it returns the raw string value.
   */
  async get<T = string | object>(key: string): Promise<T | undefined> {
    if (!key || key.includes('*')) {
      return undefined;
    }

    const value = await this.redisClient.get(`${this.cachePrefix}${key}`);
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * Stores a value in the cache with an optional time-to-live (TTL).
   *
   * @param key - The unique key to associate with the cached value.
   * @param value - The value to store in the cache. If an object is provided, it will be serialized to a JSON string.
   * @param ttl - Optional time-to-live in milliseconds. If not provided, the default cache TTL will be used.
   *              If a value less than or equal to 0 is provided, the TTL will be undefined (no expiration).
   * @returns A promise that resolves when the value has been successfully stored in the cache.
   */
  async set(key: string, value: string | object, ttl?: number): Promise<void> {
    if (typeof value === 'object') {
      value = JSON.stringify(value);
    }

    if (ttl === undefined) {
      ttl = this.defaultCacheTTL;
    } else if (ttl <= 0) {
      ttl = undefined;
    }

    await this.redisClient.set(`${this.cachePrefix}${key}`, value, { PX: ttl });
  }

  /**
   * Deletes a cache entry or multiple entries based on the provided key.
   *
   * If the key contains a wildcard character (`*`), it retrieves all matching keys
   * from the Redis store and deletes them. Otherwise, it deletes the specific key.
   *
   * @param key - The cache key to delete. Can include a wildcard (`*`) to match multiple keys.
   * @returns A promise that resolves when the deletion is complete.
   */
  async delete(key: string): Promise<void> {
    if (key.includes('*')) {
      const keys = await this.redisClient.keys(`${this.cachePrefix}${key}`);
      if (keys && keys.length) {
        await this.redisClient.del(keys);
      }
      return;
    }

    await this.redisClient.del(`${this.cachePrefix}${key}`);
  }

  /**
   * Purges cached entries from the Redis store based on the specified prefix.
   * If a prefix is provided, only keys matching the prefix will be deleted.
   * If no prefix is provided, all keys with the cache prefix will be deleted.
   *
   * @param prefix - An optional string to filter the keys to be purged.
   *                 If provided, only keys starting with `${this.cachePrefix}${prefix}` will be deleted.
   *                 If omitted, all keys starting with `${this.cachePrefix}` will be deleted.
   * @returns A promise that resolves when the purge operation is complete.
   */
  async purge(prefix?: string): Promise<void> {
    const keys = await this.redisClient.keys(
      prefix ? `${this.cachePrefix}${prefix}*` : `${this.cachePrefix}*`,
    );

    if (keys && keys.length) {
      await this.redisClient.del(keys);
    }
  }
}
