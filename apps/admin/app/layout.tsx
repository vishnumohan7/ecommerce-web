import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AdminChrome } from './components/admin-chrome';
import './theme.css';
import './orders/orders.css';

export const metadata: Metadata = {
  title: { default: 'Denes Commerce — Admin', template: '%s — Denes Admin' },
  description: 'Operations console for the Denes grocery and alcohol commerce platform.',
};

function permissionsFromToken(token: string | undefined): string[] {
  if (!token) return [];
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as {
      permissions?: unknown;
    };
    return Array.isArray(payload.permissions)
      ? payload.permissions.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const store = await cookies();
  const permissions = process.env.ADMIN_API_TOKEN
    ? null
    : permissionsFromToken(store.get('denes_admin_access')?.value);
  return (
    <html lang="en-GB">
      <body>
        <AdminChrome permissions={permissions}>{children}</AdminChrome>
      </body>
    </html>
  );
}
