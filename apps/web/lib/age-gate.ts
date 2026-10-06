export const ageGateCookie = 'age_gate';
export const ageGateSessionCookie = 'age_gate_session';
export const ageGateTtlSeconds = 30 * 24 * 60 * 60;

interface GatePayload {
  sessionId: string;
  expiresAt: number;
}

export async function issueAgeGateToken(
  sessionId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload = base64UrlEncode(
    JSON.stringify({ sessionId, expiresAt: nowSeconds + ageGateTtlSeconds } satisfies GatePayload),
  );
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifyAgeGateToken(
  token: string | undefined,
  sessionId: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!token || !sessionId || !secret) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = await sign(payload, secret);
  if (!constantTimeEqual(signature, expected)) return false;
  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as GatePayload;
    return (
      decoded.sessionId === sessionId &&
      Number.isInteger(decoded.expiresAt) &&
      decoded.expiresAt > nowSeconds
    );
  } catch {
    return false;
  }
}

export function requiresAgeGate(pathname: string, search: URLSearchParams): boolean {
  if (pathname === '/alcohol' || pathname.startsWith('/alcohol/')) return true;
  if (pathname === '/category/alcohol' || pathname.startsWith('/category/alcohol/')) return true;
  if (pathname === '/search') {
    const alcohol = search.get('alcohol')?.toLowerCase();
    const category = search.get('category')?.toLowerCase();
    return alcohol === 'true' || alcohol === '1' || category === 'alcohol';
  }
  return false;
}

export function safeReturnTo(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/alcohol';
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
  );
  let binary = '';
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
