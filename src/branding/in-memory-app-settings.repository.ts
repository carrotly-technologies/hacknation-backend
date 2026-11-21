import {
  type AppSetting,
  AppSettingsRepository,
} from './app-settings.repository.js';

/** Used without DATABASE_URL: settings live in this process only. */
export class InMemoryAppSettingsRepository extends AppSettingsRepository {
  private settings = new Map<string, AppSetting>();

  async get(key: string) {
    const setting = this.settings.get(key);
    return setting ? structuredClone(setting) : null;
  }

  async put(setting: AppSetting) {
    this.settings.set(setting.key, structuredClone(setting));
    return structuredClone(setting);
  }
}
