import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient } from 'redis';
import * as request from 'supertest';
import { CacheModule } from '../../src/cache.module';
import { CacheTrackBy } from '../../src/decorator/cache-track-by.decorator';
import { CacheInterceptor } from '../../src/interceptor/cache.interceptor';

jest.mock('redis', () => ({ createClient: jest.fn() }));
let calls = 0;
@Controller('records')
@UseInterceptors(CacheInterceptor)
class RecordsController {
  @Get(':id')
  @CacheTrackBy({
    prefix: 'records',
    by: [
      { by: 'param', name: 'id' },
      { by: 'pagination', name: '' },
    ],
  })
  get(@Param('id') id: string) {
    return { id, calls: ++calls };
  }
}

describe('Nest HTTP integration', () => {
  it('uses real decorator metadata and Express query values for cache keys', async () => {
    calls = 0;
    const values = new Map<string, string>();
    const client = {
      connect: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(async (key: string) => values.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
    };
    (createClient as jest.Mock).mockReturnValue(client);
    const module = await Test.createTestingModule({
      imports: [
        CacheModule.register({ redis: { host: 'localhost', port: 6379 } }),
      ],
      controllers: [RecordsController],
    }).compile();
    const app = module.createNestApplication();
    try {
      await app.listen(0, '127.0.0.1');
      await request(app.getHttpServer())
        .get('/records/123?limit=20&offset=0')
        .expect(200, { id: '123', calls: 1 });
      await request(app.getHttpServer())
        .get('/records/123?limit=20&offset=0')
        .expect(200, { id: '123', calls: 1 });
      await request(app.getHttpServer())
        .get('/records/123?limit=20&offset=20')
        .expect(200, { id: '123', calls: 2 });
      expect(client.get).toHaveBeenCalledWith('cache:records-123-20-0');
      expect(client.set).toHaveBeenCalledWith(
        'cache:records-123-20-0',
        '{"id":"123","calls":1}',
        { PX: 1000 },
      );
    } finally {
      await app.close();
    }
  });
});
