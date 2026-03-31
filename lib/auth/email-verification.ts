import { createHash, randomBytes } from 'crypto';

export function createEmailVerificationToken() {
  return randomBytes(32).toString('hex');
}

export function hashEmailVerificationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
