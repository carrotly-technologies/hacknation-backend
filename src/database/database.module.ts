import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule, getDrizzleToken } from '@nestjs/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DATABASE, MIGRATIONS_FOLDER } from './database.js';

/**
 * Shared PostgreSQL connection (Drizzle + pg), global. With DATABASE_URL set
 * it connects and applies pending migrations before the first request is
 * served; without it, DATABASE is `null` and modules use in-memory storage,
 * so `npm run start` and the tests work without a database.
 */
@Module({})
export class DatabaseModule {
  static async forRoot(): Promise<DynamicModule> {
    await ConfigModule.envVariablesLoaded;
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      new Logger(DatabaseModule.name).log(
        'DATABASE_URL not set: in-memory storage (data is lost on restart).',
      );
      return {
        module: DatabaseModule,
        global: true,
        providers: [{ provide: DATABASE, useValue: null }],
        exports: [DATABASE],
      };
    }
    return {
      module: DatabaseModule,
      global: true,
      imports: [
        DrizzleModule.forRootAsync({
          useFactory: async () => {
            const db = drizzle({ connection: url });
            await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
            new Logger(DatabaseModule.name).log(
              'PostgreSQL connected, migrations applied.',
            );
            return { db };
          },
        }),
      ],
      providers: [{ provide: DATABASE, useExisting: getDrizzleToken() }],
      exports: [DATABASE],
    };
  }
}
