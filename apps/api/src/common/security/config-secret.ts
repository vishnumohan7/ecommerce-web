import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const keyFor = (secret: string) => createHash('sha256').update(`denes-config:${secret}`).digest();

export function encryptConfigSecret(value: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['enc', 'v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join(':');
}

export function decryptConfigSecret(value: string, secret: string): string {
  if (!value.startsWith('enc:v1:')) return value;
  const [, , encodedIv, encodedTag, encodedData] = value.split(':');
  if (!encodedIv || !encodedTag || !encodedData) throw new Error('Invalid encrypted configuration');
  const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), Buffer.from(encodedIv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedData, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
