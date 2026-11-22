import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createFieldCipher } from './crypto.module.js';
import {
  DEV_DATA_ENCRYPTION_KEY,
  FieldCipher,
  isEncrypted,
  parseDataKey,
} from './field-cipher.js';

const key = randomBytes(32);

describe('FieldCipher', () => {
  const cipher = new FieldCipher(key);

  it('encrypts to v1:<iv>:<tag>:<ciphertext> and reads it back', () => {
    const text = 'Uzasadnienie: zażółć gęślą jaźń. Obserwacja S-D-R.';
    const stored = cipher.encrypt(text);
    expect(stored).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
    expect(stored).not.toContain('Uzasadnienie');
    expect(isEncrypted(stored)).toBe(true);
    expect(cipher.decrypt(stored)).toBe(text);
  });

  it('uses a fresh IV, so the same text never gives the same value', () => {
    expect(cipher.encrypt('tekst')).not.toBe(cipher.encrypt('tekst'));
  });

  it('encrypts an empty string', () => {
    expect(cipher.decrypt(cipher.encrypt(''))).toBe('');
  });

  it('returns plain text (rows before the migration) unchanged', () => {
    expect(cipher.decrypt('zwykła notatka')).toBe('zwykła notatka');
    expect(cipher.decrypt('v1: notatka z dwukropkiem')).toBe(
      'v1: notatka z dwukropkiem',
    );
  });

  it('rejects a tampered value and a value of another key', () => {
    const stored = cipher.encrypt('tekst');
    const [v, iv, tag, data] = stored.split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    expect(() =>
      cipher.decrypt([v, iv, tag, flipped.toString('base64')].join(':')),
    ).toThrow(/Cannot decrypt/);
    expect(() => new FieldCipher(randomBytes(32)).decrypt(stored)).toThrow(
      /Cannot decrypt/,
    );
  });

  it('rejects an unknown key version', () => {
    const stored = cipher.encrypt('tekst').replace(/^v1:/, 'v9:');
    expect(() => cipher.decrypt(stored)).toThrow(/version v9/);
  });

  it('reads values of a fallback key and marks them for re-encryption', () => {
    const old = new FieldCipher(DEV_DATA_ENCRYPTION_KEY).encrypt('stary');
    const current = new FieldCipher(key, [DEV_DATA_ENCRYPTION_KEY]);
    expect(current.decrypt(old)).toBe('stary');
    expect(current.needsEncryption(old)).toBe(true);
    expect(current.needsEncryption('jawny tekst')).toBe(true);
    expect(current.needsEncryption(current.encrypt('nowy'))).toBe(false);
  });
});

describe('DATA_ENCRYPTION_KEY', () => {
  it('accepts 32 bytes in base64 and rejects other lengths', () => {
    expect(parseDataKey(key.toString('base64'))).toEqual(key);
    expect(() => parseDataKey(randomBytes(16).toString('base64'))).toThrow(
      /32 bytes/,
    );
  });

  it('falls back to the dev key without the variable', () => {
    const dev = createFieldCipher(new ConfigService({}));
    expect(
      new FieldCipher(DEV_DATA_ENCRYPTION_KEY).decrypt(dev.encrypt('x')),
    ).toBe('x');
  });

  it('encrypts with the configured key', () => {
    const configured = createFieldCipher(
      new ConfigService({ DATA_ENCRYPTION_KEY: key.toString('base64') }),
    );
    expect(new FieldCipher(key).decrypt(configured.encrypt('x'))).toBe('x');
  });
});
