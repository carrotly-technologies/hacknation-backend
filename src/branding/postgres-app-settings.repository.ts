import { eq } from 'drizzle-orm';
import type { Database } from '../database/database.js';
import {
  type AppSetting,
  AppSettingsRepository,
} from './app-settings.repository.js';
import { appSettings } from './app-settings.tables.js';

type SettingRow = typeof appSettings.$inferSelect;

const toSetting = (row: SettingRow): AppSetting => ({
  ...row,
  updatedAt: row.updatedAt.toISOString(),
});

/** Used with DATABASE_URL: table app_settings. */
export class PostgresAppSettingsRepository extends AppSettingsRepository {
  constructor(private readonly db: Database) {
    super();
  }

  async get(key: string) {
    const [row] = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key));
    return row ? toSetting(row) : null;
  }

  async put(setting: AppSetting) {
    const values = {
      value: setting.value,
      updatedAt: new Date(setting.updatedAt),
    };
    const [row] = await this.db
      .insert(appSettings)
      .values({ key: setting.key, ...values })
      .onConflictDoUpdate({ target: appSettings.key, set: values })
      .returning();
    return toSetting(row);
  }
}
