/** One setting: any JSON value, with the time it was last written. */
export interface AppSetting {
  key: string;
  value: unknown;
  /** ISO 8601 timestamp (UTC). */
  updatedAt: string;
}

/** Storage of the app settings: one value per key, the last write wins. */
export abstract class AppSettingsRepository {
  /** null when the key was never written. */
  abstract get(key: string): Promise<AppSetting | null>;
  /** Inserts the key or replaces its value. */
  abstract put(setting: AppSetting): Promise<AppSetting>;
}
