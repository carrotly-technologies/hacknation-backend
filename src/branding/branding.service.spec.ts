import type { AuthenticationContext } from '@nestjs/authentication';
import type { User } from '../auth/user.types.js';
import { BrandingService, LOGO_SETTING } from './branding.service.js';
import { InMemoryAppSettingsRepository } from './in-memory-app-settings.repository.js';

const user: User = {
  id: 'u-kaminska',
  login: 'j.kaminska',
  firstName: 'Joanna',
  lastName: 'Kamińska',
  role: 'SUPERVISOR',
  position: 'Naczelniczka wydziału',
  unit: 'Wydział',
  evaluatorId: 'ev-kaminska',
};

describe('BrandingService', () => {
  let repo: InMemoryAppSettingsRepository;
  let service: BrandingService;

  beforeEach(() => {
    repo = new InMemoryAppSettingsRepository();
    const auth = {
      requireUser: () => user,
    } as unknown as AuthenticationContext;
    service = new BrandingService(repo, auth);
  });

  it('has no logo until one is accepted', async () => {
    expect(await service.getLogo()).toEqual({
      logoId: null,
      acceptedAt: null,
      acceptedBy: null,
    });
  });

  it('keeps the accepted logo with who accepted it and when', async () => {
    const accepted = await service.acceptLogo('10-plakietka-z-roza');
    expect(accepted).toEqual({
      logoId: '10-plakietka-z-roza',
      acceptedAt: expect.any(String),
      acceptedBy: { id: 'u-kaminska', name: 'Joanna Kamińska' },
    });
    expect(await service.getLogo()).toEqual(accepted);
  });

  it('ignores a stored id that is no longer a proposal, or a malformed value', async () => {
    const updatedAt = '2026-11-21T10:00:00.000Z';
    await repo.put({
      key: LOGO_SETTING,
      value: { logoId: '99-usuniete', acceptedBy: { id: 'u1', name: 'A' } },
      updatedAt,
    });
    expect((await service.getLogo()).logoId).toBeNull();
    await repo.put({ key: LOGO_SETTING, value: 'zepsute', updatedAt });
    expect((await service.getLogo()).logoId).toBeNull();
  });
});
