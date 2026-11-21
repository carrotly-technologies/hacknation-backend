// Prints the scrypt hash of a password for the user seed (src/auth/users.seed.ts).
// Usage: node scripts/hash-password.mjs <password>
import { PasswordHasher } from '@nestjs/authentication';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}
console.log(await new PasswordHasher().hash(password));
