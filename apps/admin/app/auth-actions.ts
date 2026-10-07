'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_BASE_URL } from './lib/api';

function jwtPermissions(token: string): string[] {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as { permissions?: unknown };
    return Array.isArray(payload.permissions) ? payload.permissions.filter((value): value is string => typeof value === 'string') : [];
  } catch { return []; }
}

export async function adminLogin(data: FormData) {
  const emailValue = data.get('email');
  const passwordValue = data.get('password');
  const email = typeof emailValue === 'string' ? emailValue.trim() : '';
  const password = typeof passwordValue === 'string' ? passwordValue : '';
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }), cache: 'no-store' });
  if (!response.ok) redirect('/login?error=Invalid+email+or+password');
  const pair = await response.json() as { accessToken: string; refreshToken: string; accessExpiresInSeconds: number };
  const permissions = jwtPermissions(pair.accessToken);
  if (!permissions.some((permission) => ['users.read', 'settings.read', 'reports.read', 'orders.write', 'catalog.write'].includes(permission))) redirect('/login?error=This+account+does+not+have+admin+access');
  const store = await cookies();
  store.set('denes_admin_access', pair.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: pair.accessExpiresInSeconds });
  store.set('denes_admin_refresh', pair.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 30 * 24 * 60 * 60 });
  redirect('/');
}

export async function adminLogout() {
  const store = await cookies();
  store.delete('denes_admin_access');
  store.delete('denes_admin_refresh');
  redirect('/login');
}
