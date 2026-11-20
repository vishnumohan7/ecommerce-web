/* eslint-disable local/no-jsx-literals -- Storefront account navigation is currently English-only. */
import Link from 'next/link';

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
      <Link href="/auth/login">Sign in / switch account</Link>
    </aside>
  );
}
