import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { RetentionService } from './retention.service.js';

/**
 * `npm run retention` (after `npm run build`; in the Docker image:
 * `node dist/retention/retention.cli.js`). Applies the retention policy to the
 * configured storage once and prints the counts.
 */
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn', 'log'],
});
try {
  const report = await app.get(RetentionService).run();
  console.log(JSON.stringify(report, null, 2));
} finally {
  await app.close();
}
process.exit(0);
