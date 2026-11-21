import { defineConfig } from 'drizzle-kit';

// `npx drizzle-kit generate --name=<change>` after a change in a *.tables.ts
// file; the app applies the migrations in drizzle/ itself at startup.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/**/*.tables.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://hacknation:hacknation@localhost:5432/hacknation',
  },
});
