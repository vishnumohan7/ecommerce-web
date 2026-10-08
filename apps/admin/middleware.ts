import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'denes_admin_access';
const REFRESH_COOKIE = 'denes_admin_refresh';
const REMEMBER_COOKIE = 'denes_admin_remember';
const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

type TokenPair = { accessToken: string; refreshToken: string; accessExpiresInSeconds: number };

function accessTokenIsCurrent(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const part = token.split('.')[1];
    if (!part) return false;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized)) as { exp?: unknown };
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000) + 30;
  } catch {
    return false;
  }
}

async function rotate(refreshToken: string): Promise<TokenPair | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const pair = (await response.json()) as Partial<TokenPair>;
    return typeof pair.accessToken === 'string' && typeof pair.refreshToken === 'string' && typeof pair.accessExpiresInSeconds === 'number'
      ? pair as TokenPair
      : null;
  } catch {
    return null;
  }
}

function sessionCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

export async function middleware(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === '/login';
  const configuredToken = process.env.ADMIN_API_TOKEN;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (configuredToken || accessTokenIsCurrent(accessToken)) {
    if (isLogin) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const pair = refreshToken ? await rotate(refreshToken) : null;
  if (!pair) {
    if (isLogin) return NextResponse.next();
    const response = NextResponse.redirect(new URL('/login?error=Your+session+expired.+Please+sign+in+again.', request.url));
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    response.cookies.delete(REMEMBER_COOKIE);
    return response;
  }

  const remembered = request.cookies.get(REMEMBER_COOKIE)?.value === '1';
  const accessMaxAge = remembered ? pair.accessExpiresInSeconds : undefined;
  const refreshMaxAge = remembered ? 30 * 24 * 60 * 60 : undefined;
  if (isLogin) {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set(ACCESS_COOKIE, pair.accessToken, sessionCookieOptions(accessMaxAge));
    response.cookies.set(REFRESH_COOKIE, pair.refreshToken, sessionCookieOptions(refreshMaxAge));
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  const requestCookies = request.cookies;
  requestCookies.set(ACCESS_COOKIE, pair.accessToken);
  requestCookies.set(REFRESH_COOKIE, pair.refreshToken);
  requestHeaders.set('cookie', requestCookies.toString());
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(ACCESS_COOKIE, pair.accessToken, sessionCookieOptions(accessMaxAge));
  response.cookies.set(REFRESH_COOKIE, pair.refreshToken, sessionCookieOptions(refreshMaxAge));
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
