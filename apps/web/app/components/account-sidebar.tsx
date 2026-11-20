'use client';

/* eslint-disable local/no-jsx-literals -- Storefront account navigation is currently English-only. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserApi } from '../../lib/store-api';

type AccountSection = 'orders' | 'wishlist' | 'addresses' | 'profile';

interface AccountSidebarProps {
  active: AccountSection;
}

const links: Array<{ href: string; label: string; section: AccountSection }> = [
  { href: '/orders', label: 'My orders & tracking', section: 'orders' },
  { href: '/wishlist', label: 'Saved favourites', section: 'wishlist' },
  { href: '/addresses', label: 'Saved addresses', section: 'addresses' },
  { href: '/profile', label: 'Account settings', section: 'profile' },
];

export function AccountSidebar({ active }: Readonly<AccountSidebarProps>) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await browserApi('/api/v1/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined);
    router.replace('/auth/login');
    router.refresh();
  }

  return (
    <aside className="account-sidebar">
      <strong>My account</strong>
      {links.map((link) => (
        <Link
          className={active === link.section ? 'active' : undefined}
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
      <button
        className="account-sidebar-action"
        disabled={signingOut}
        type="button"
        onClick={() => void signOut()}
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </aside>
  );
}
