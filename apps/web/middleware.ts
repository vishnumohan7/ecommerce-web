import { NextRequest, NextResponse } from 'next/server';
import {
  ageGateCookie,
  ageGateSessionCookie,
  ageGateTtlSeconds,
  requiresAgeGate,
  verifyAgeGateToken,
} from './lib/age-gate';

export async function middleware(request: NextRequest) {
  const restricted =
    requiresAgeGate(request.nextUrl.pathname, request.nextUrl.searchParams) ||
    (await restrictedProduct(request));
  if (!restricted) return NextResponse.next();

  const secret = process.env.AGE_GATE_SECRET ?? process.env.JWT_ACCESS_SECRET ?? '';
  const existingSession = request.cookies.get(ageGateSessionCookie)?.value;
  const sessionId = validSession(existingSession)
    ? (existingSession as string)
    : crypto.randomUUID();
  const valid = await verifyAgeGateToken(
    request.cookies.get(ageGateCookie)?.value,
    sessionId,
    secret,
  );
  if (valid) return NextResponse.next();

  const interstitial = request.nextUrl.clone();
  interstitial.pathname = '/age-gate';
  interstitial.search = '';
  interstitial.searchParams.set('returnTo', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.rewrite(interstitial);
  response.cookies.set(ageGateSessionCookie, sessionId, cookieOptions());
  return response;
}

async function restrictedProduct(request: NextRequest): Promise<boolean> {
  if (!request.nextUrl.pathname.startsWith('/product/')) return false;
  const identifier = request.nextUrl.pathname.slice('/product/'.length).split('/')[0];
  if (!identifier) return false;
  const api = (
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://127.0.0.1:3000'
  ).replace(/\/$/, '');
  try {
    const response = await fetch(`${api}/api/v1/products/${encodeURIComponent(identifier)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return true;
    const product = (await response.json()) as { ageRestriction?: unknown };
    return typeof product.ageRestriction === 'number' && product.ageRestriction > 0;
  } catch {
    return true;
  }
}

function validSession(value: string | undefined): boolean {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ageGateTtlSeconds,
  };
}

export const config = {
  matcher: ['/alcohol/:path*', '/category/alcohol/:path*', '/product/:path*', '/search'],
};
