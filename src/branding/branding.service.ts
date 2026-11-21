import { Inject, Injectable } from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { toUserView } from '../auth/user.types.js';
import { AppSettingsRepository } from './app-settings.repository.js';
import type { LogoChoice } from './branding.types.js';
import { isLogoId, type LogoId } from './logos.js';

/** Key of the accepted logo in app_settings. */
export const LOGO_SETTING = 'logo';

const NO_LOGO: LogoChoice = {
  logoId: null,
  acceptedAt: null,
  acceptedBy: null,
};

interface StoredLogo {
  logoId: string;
  acceptedBy: { id: string; name: string };
}

function isStoredLogo(value: unknown): value is StoredLogo {
  const v = value as Partial<StoredLogo> | null;
  return (
    !!v &&
    typeof v.logoId === 'string' &&
    typeof v.acceptedBy?.id === 'string' &&
    typeof v.acceptedBy?.name === 'string'
  );
}

/** The logo the office accepted on /logo; the whole app shows it. */
@Injectable()
export class BrandingService {
  constructor(
    @Inject(AppSettingsRepository)
    private readonly settings: AppSettingsRepository,
    private readonly auth: AuthenticationContext,
  ) {}

  /** No choice yet, or one no longer among the proposals: all null. */
  async getLogo(): Promise<LogoChoice> {
    const setting = await this.settings.get(LOGO_SETTING);
    if (
      !setting ||
      !isStoredLogo(setting.value) ||
      !isLogoId(setting.value.logoId)
    )
      return NO_LOGO;
    return {
      logoId: setting.value.logoId,
      acceptedAt: setting.updatedAt,
      acceptedBy: setting.value.acceptedBy,
    };
  }

  /** Any signed-in user may accept; who and when is kept with the choice. */
  async acceptLogo(logoId: LogoId): Promise<LogoChoice> {
    const user = toUserView(this.auth.requireUser());
    const value: StoredLogo = {
      logoId,
      acceptedBy: { id: user.id, name: user.name },
    };
    const saved = await this.settings.put({
      key: LOGO_SETTING,
      value,
      updatedAt: new Date().toISOString(),
    });
    return {
      logoId,
      acceptedAt: saved.updatedAt,
      acceptedBy: value.acceptedBy,
    };
  }
}
