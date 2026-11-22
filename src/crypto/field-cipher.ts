import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/**
 * Application-side encryption of free-text fields about the assessed person
 * (RODO art. 32: encryption at rest). AES-256-GCM, a fresh 12-byte IV per
 * value, stored as `v1:<iv>:<tag>:<ciphertext>` (base64 parts). `v1` is the
 * key version: a new key gets `v2` and old values stay readable.
 */
export const KEY_VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const ENCRYPTED = /^v\d+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]*$/;

/**
 * Dev-only key, used without DATA_ENCRYPTION_KEY. It is public (it is in the
 * code), so it only keeps the format the same; production must set its own.
 */
export const DEV_DATA_ENCRYPTION_KEY = createHash('sha256')
  .update('kompas-dev-only-data-key-change-me-in-production')
  .digest();

/** True for a value in the `v<n>:<iv>:<tag>:<ciphertext>` format. */
export function isEncrypted(value: string): boolean {
  return ENCRYPTED.test(value);
}

/** DATA_ENCRYPTION_KEY: 32 bytes in base64 (`openssl rand -base64 32`). */
export function parseDataKey(base64: string): Buffer {
  const key = Buffer.from(base64.trim(), 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `DATA_ENCRYPTION_KEY must be ${KEY_BYTES} bytes in base64 (openssl rand -base64 32); got ${key.length} bytes.`,
    );
  }
  return key;
}

export class FieldCipher {
  private readonly fallbackKeys: Buffer[];

  /**
   * `key` encrypts; `fallbackKeys` only decrypt (e.g. the dev key, so data
   * written before the real key was set stays readable until re-encrypted).
   */
  constructor(
    private readonly key: Buffer,
    fallbackKeys: Buffer[] = [],
  ) {
    if (key.length !== KEY_BYTES) {
      throw new Error(`The data key must be ${KEY_BYTES} bytes.`);
    }
    this.fallbackKeys = fallbackKeys.filter((k) => !k.equals(key));
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      KEY_VERSION,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      data.toString('base64'),
    ].join(':');
  }

  /**
   * The plain text. A value not in the encrypted format is returned as it is
   * (rows written before the encryption migration). Throws for a value that
   * was tampered with or encrypted with an unknown key.
   */
  decrypt(value: string): string {
    return this.open(value).plain;
  }

  /**
   * True when the value is plain text or encrypted with a fallback key: the
   * migration rewrites it with the current key. False when it is already
   * encrypted with the current key (so the migration is idempotent).
   */
  needsEncryption(value: string): boolean {
    return !isEncrypted(value) || !this.open(value).current;
  }

  private open(value: string): { plain: string; current: boolean } {
    if (!isEncrypted(value)) return { plain: value, current: false };
    const [version, iv, tag, data] = value.split(':');
    if (version !== KEY_VERSION) {
      throw new Error(`Unknown data key version ${version}.`);
    }
    for (const [i, key] of [this.key, ...this.fallbackKeys].entries()) {
      try {
        const decipher = createDecipheriv(
          ALGORITHM,
          key,
          Buffer.from(iv, 'base64'),
        );
        decipher.setAuthTag(Buffer.from(tag, 'base64'));
        const plain = Buffer.concat([
          decipher.update(Buffer.from(data, 'base64')),
          decipher.final(),
        ]).toString('utf8');
        return { plain, current: i === 0 };
      } catch {
        // wrong key or tampered value: try the next key
      }
    }
    throw new Error(
      'Cannot decrypt a stored value: wrong DATA_ENCRYPTION_KEY or the value was changed.',
    );
  }
}
