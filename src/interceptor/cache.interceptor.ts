import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, tap } from 'rxjs';
import { Request } from 'express';
import { CacheManager } from '../manager/cache.manager';
import {
  CacheTrackByMetadata,
  CACHE_TRACK_BY_KEY,
} from '../decorator/cache-track-by.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    protected readonly cacheManager: CacheManager,
    protected readonly reflector: Reflector,
  ) {}

  private readonly allowedMethods = ['GET'];

  async intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Promise<Observable<any>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    if (!this.allowedMethods.includes(request.method)) {
      return next.handle();
    }

    const { prefix, by, ttl } = this.reflector.get<{
      prefix: string;
      by: CacheTrackByMetadata | CacheTrackByMetadata[];
      ttl: number;
    }>(CACHE_TRACK_BY_KEY, context.getHandler());

    const key = this.trackBy(request, prefix, by);

    if (!key) {
      return next.handle();
    }

    const value = await this.cacheManager.get(key);

    if (value) {
      return of(value);
    }

    return next.handle().pipe(
      tap(async (response) => {
        await this.cacheManager.set(key, response, ttl ?? 1000);
      }),
    );
  }

  protected trackBy(
    request: Request,
    prefix: string,
    by: CacheTrackByMetadata | CacheTrackByMetadata[],
  ): string {
    if (!by || !prefix) {
      return undefined;
    }

    let key = `${prefix}-`;

    if (!Array.isArray(by)) {
      key += this.getValue(request, by);
    } else {
      key += by.map((metadata) => this.getValue(request, metadata)).join('-');
    }

    return key;
  }

  protected getValue(request: any, metadata: CacheTrackByMetadata): string {
    switch (metadata.by) {
      case 'header':
        return request.headers[metadata.name];
      case 'param':
        return request.params[metadata.name];
      case 'user':
        return request.user[metadata.name];
      case 'pagination':
        return `${request.query.limit}-${request.query.offset}`;
      case 'query':
        return request.query[metadata.name];
      default:
        return undefined;
    }
  }
}
