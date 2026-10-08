import { NextRequest, NextResponse } from 'next/server';
import { API_BASE } from '../../../../lib/store-api';

const ACCESS_COOKIE = 'denes_store_access';
const REFRESH_COOKIE = 'denes_store_refresh';
type TokenPair = { accessToken: string; refreshToken: string; accessExpiresInSeconds: number };

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = `${API_BASE}/${path.join('/')}${request.nextUrl.search}`;
  try {
    const requestBody =
      request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined;
    const isLogin = path.join('/') === 'api/v1/auth/login';
    const isLogout = path.join('/') === 'api/v1/auth/logout';
    const body = isLogout
      ? JSON.stringify({ refreshToken: request.cookies.get(REFRESH_COOKIE)?.value ?? '' })
      : requestBody;
    const init: RequestInit = {
      method: request.method,
      headers: forwardedHeaders(request),
      cache: 'no-store',
    };
    if (body !== undefined) init.body = body;
    let upstream = await fetch(target, init);
    let refreshed: TokenPair | null = null;
    if (upstream.status === 401 && !isLogin && !isLogout) {
      refreshed = await refreshSession(request);
      if (refreshed) {
        const headers = forwardedHeaders(request, refreshed.accessToken);
        upstream = await fetch(target, { ...init, headers });
      }
    }
    if (isLogin && upstream.ok) {
      const pair = (await upstream.json()) as TokenPair;
      const response = NextResponse.json({ authenticated: true });
      setSessionCookies(response, pair);
      return response;
    }
    const response = new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
    if (refreshed) setSessionCookies(response, refreshed);
    if (isLogout) clearSessionCookies(response);
    const cookie = upstream.headers.get('set-cookie');
    if (cookie) response.headers.set('set-cookie', cookie);
    return response;
  } catch {
    return NextResponse.json(
      { message: 'The commerce API is temporarily unavailable.' },
      { status: 503 },
    );
  }
}

function forwardedHeaders(request: NextRequest, accessToken?: string) {
  const headers = new Headers();
  for (const name of ['content-type', 'cookie', 'x-age-gate-token', 'x-session-id']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const gateSession = request.cookies.get('age_gate_session')?.value;
  if (gateSession && !headers.has('x-session-id')) headers.set('x-session-id', gateSession);
  const access = accessToken ?? request.cookies.get(ACCESS_COOKIE)?.value;
  if (access) headers.set('authorization', `Bearer ${access}`);
  return headers;
}

async function refreshSession(request: NextRequest): Promise<TokenPair | null> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as TokenPair;
}

function setSessionCookies(response: NextResponse, pair: TokenPair) {
  const common = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  } as const;
  response.cookies.set(ACCESS_COOKIE, pair.accessToken, {
    ...common,
    sameSite: 'lax',
    maxAge: pair.accessExpiresInSeconds,
  });
  response.cookies.set(REFRESH_COOKIE, pair.refreshToken, {
    ...common,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60,
  });
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(REFRESH_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
