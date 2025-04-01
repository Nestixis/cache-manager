import { Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CacheTrackByMetadata } from '../decorator/cache-track-by.decorator';
import { tap } from 'rxjs';
import { CacheManager } from '../manager/cache.manager';

@Injectable()
export class CacheRemoveInterceptor implements NestInterceptor {
  constructor(
    protected readonly cacheManager: CacheManager,
    protected readonly reflector: Reflector,
  ) {}

  intercept(context: any, next: any): any {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    const { prefix, by } = this.reflector.get<{
      prefix: string;
      by: CacheTrackByMetadata | CacheTrackByMetadata[];
    }>('CACHE_TRACK_BY_KEY', context.getHandler());

    const key = this.trackBy(request, prefix, by);

    if (!key) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        await this.cacheManager.delete(key);
      }),
    );
  }

  private trackBy(
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

  private getValue(request: any, metadata: CacheTrackByMetadata): string {
    switch (metadata.by) {
      case 'header':
        return request.headers[metadata.name];
      case 'param':
        return request.params[metadata.name];
      case 'user':
        return request.user[metadata.name];
      case 'pagination':
        return `*`;
      case 'query':
        return request.query[metadata.name];
      default:
        return undefined;
    }
  }
}
