import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { RetentionService } from './retention/retention.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config = app.get(ConfigService);
  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
  app.get(RetentionService).schedule();
}
await bootstrap();
