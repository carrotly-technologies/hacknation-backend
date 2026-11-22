import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEV_DATA_ENCRYPTION_KEY,
  FieldCipher,
  parseDataKey,
} from './field-cipher.js';

/**
 * The cipher from DATA_ENCRYPTION_KEY. Without it (dev, demo) the public
 * dev-only key is used and a warning is logged, like JWT_SECRET. Data written
 * with the dev key stays readable after the real key is set and is
 * re-encrypted with it at the next start (`needsEncryption`).
 */
export function createFieldCipher(config: ConfigService): FieldCipher {
  const value = config.get<string>('DATA_ENCRYPTION_KEY')?.trim();
  if (!value) {
    new Logger('Crypto').warn(
      'DATA_ENCRYPTION_KEY is not set: encrypting stored notes and observations with the dev-only default key. Set DATA_ENCRYPTION_KEY (32 bytes, openssl rand -base64 32) in production.',
    );
    return new FieldCipher(DEV_DATA_ENCRYPTION_KEY);
  }
  return new FieldCipher(parseDataKey(value), [DEV_DATA_ENCRYPTION_KEY]);
}

@Module({
  providers: [
    {
      provide: FieldCipher,
      inject: [ConfigService],
      useFactory: createFieldCipher,
    },
  ],
  exports: [FieldCipher],
})
export class CryptoModule {}
