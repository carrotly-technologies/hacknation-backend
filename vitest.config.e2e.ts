import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Suites sign in before every test: lift the rate limits here
    // (test/security.e2e-spec.ts checks the defaults).
    env: {
      RATE_LIMIT_PER_MINUTE: '100000',
      RATE_LIMIT_LOGIN_PER_MINUTE: '100000',
    },
  },
});
