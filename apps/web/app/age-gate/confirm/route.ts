import { NextRequest, NextResponse } from 'next/server';
import {
  ageGateCookie,
  ageGateSessionCookie,
  ageGateTtlSeconds,
  issueAgeGateToken,
  safeReturnTo,
} from '../../../lib/age-gate';

export async function POST(request: NextRequest) {
  const secret = process.env.AGE_GATE_SECRET ?? process.env.JWT_ACCESS_SECRET ?? '';
  if (secret.length < 32)
    return NextResponse.json({ error: 'Age gate signing is unavailable' }, { status: 503 });
  const existing = request.cookies.get(ageGateSessionCookie)?.value;
  const sessionId = existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : crypto.randomUUID();
  const origin = `${request.nextUrl.protocol}//${request.headers.get('host') ?? request.nextUrl.host}`;
  const response = NextResponse.redirect(
    new URL(safeReturnTo(request.nextUrl.searchParams.get('returnTo')), origin),
    303,
  );
  const options = cookieOptions();
  response.cookies.set(ageGateSessionCookie, sessionId, options);
  response.cookies.set(ageGateCookie, await issueAgeGateToken(sessionId, secret), options);
  return response;
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
