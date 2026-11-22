import { InMemoryRequestLogRepository } from './in-memory-request-log.repository.js';
import { MonitorService } from './monitor.service.js';
import type { RequestLogEntry } from './monitor.types.js';

const fields: Omit<RequestLogEntry, 'id' | 'at'> = {
  sessionId: null,
  kind: 'API',
  method: 'GET',
  path: '/api/me',
  status: 200,
  durationMs: 1,
  ip: null,
  userAgent: null,
  userId: null,
  userName: null,
};

describe('MonitorService', () => {
  it('removes entries older than 30 days at startup and keeps the rest', async () => {
    const repo = new InMemoryRequestLogRepository();
    const day = 24 * 60 * 60 * 1000;
    await repo.insert({
      ...fields,
      id: 'old',
      at: new Date(Date.now() - 31 * day).toISOString(),
    });
    await repo.insert({
      ...fields,
      id: 'recent',
      at: new Date(Date.now() - 29 * day).toISOString(),
    });
    const service = new MonitorService(repo);
    await service.onModuleInit();
    service.onModuleDestroy();
    expect((await repo.list({})).map((e) => e.id)).toEqual(['recent']);
  });

  it('never throws when a write fails', async () => {
    const repo = new InMemoryRequestLogRepository();
    vi.spyOn(repo, 'insert').mockRejectedValue(new Error('db down'));
    const service = new MonitorService(repo);
    expect(() => service.record(fields)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
