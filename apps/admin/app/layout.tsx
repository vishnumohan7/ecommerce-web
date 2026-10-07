/* eslint-disable local/no-jsx-literals -- Milestone 17 preview copy is English-only until the localisation catalogue lands. */
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './theme.css';
import './orders/orders.css';
import { adminLogout } from './auth-actions';

export const metadata: Metadata = {
  title: { default: 'Denes Commerce — Admin', template: '%s — Denes Admin' },
  description: 'Operations console for the Denes grocery and alcohol commerce platform.',
};

const navigation = [
  { href: '/', label: 'Overview', icon: 'grid' },
  { href: '/products', label: 'Products', icon: 'box' },
  { href: '/catalogue', label: 'Categories & brands', icon: 'layers' },
  { href: '/inventory', label: 'Inventory', icon: 'box' },
  { href: '/promotions', label: 'Promotions', icon: 'promo' },
  { href: '/orders', label: 'Orders', icon: 'orders' },
  { href: '/returns', label: 'Returns & refunds', icon: 'returns' },
  { href: '/delivery', label: 'Delivery', icon: 'truck' },
  { href: '/pricing', label: 'Pricing & tax', icon: 'promo' },
  { href: '/customers', label: 'Customers', icon: 'users' },
  { href: '/reviews', label: 'Reviews', icon: 'check' },
  { href: '/content', label: 'Banners & CMS', icon: 'layers' },
  { href: '/notifications', label: 'Notifications', icon: 'pulse' },
  { href: '/reports', label: 'Reports', icon: 'grid' },
  { href: '/access', label: 'Roles & permissions', icon: 'users' },
  { href: '/settings', label: 'Settings & branding', icon: 'check' },
  { href: '/audit', label: 'Audit logs', icon: 'orders' },
  { href: '/privacy', label: 'GDPR requests', icon: 'check' },
  { href: '/license', label: 'Licence', icon: 'check' },
  { href: '/system', label: 'System health', icon: 'pulse' },
  { href: '/feature-status', label: 'Feature status', icon: 'check' },
] as const;

function NavIcon({ name }: Readonly<{ name: string }>) {
  return <span className={`nav-icon nav-icon-${name}`} aria-hidden="true" />;
}

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>
        <div className="admin-shell">
          <aside className="sidebar" aria-label="Primary navigation">
            <Link className="brand" href="/" aria-label="Denes admin home">
              <span className="brand-mark">D</span>
              <span>
                <strong>DENES</strong>
                <small>Commerce admin</small>
              </span>
            </Link>
            <nav className="desktop-nav">
              <p className="nav-caption">Workspace</p>
              {navigation.map((item) => (
                <Link href={item.href} key={item.href}>
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="sidebar-foot">
              <span className="status-dot" />
              <span>
                <strong>Live operations</strong>
                <small>Supabase connected</small>
              </span>
            </div>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <details className="mobile-menu">
                <summary aria-label="Open navigation">
                  <span />
                  <span />
                  <span />
                </summary>
                <nav>
                  {navigation.map((item) => (
                    <Link href={item.href} key={item.href}>
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </details>
              <form className="global-search" action="/products" role="search">
                <span aria-hidden="true" />
                <label className="sr-only" htmlFor="global-search">
                  Search catalogue
                </label>
                <input id="global-search" name="q" placeholder="Search products and SKUs…" />
              </form>
              <div className="topbar-actions">
                <span className="preview-pill">Permission enforced</span>
                <span className="avatar" aria-hidden="true">
                  DA
                </span>
                <span className="operator">
                  <strong>Administrator</strong>
                  <small>Operations</small>
                </span>
                <form action={adminLogout}><button className="text-action" type="submit">Sign out</button></form>
              </div>
            </header>
            <main className="content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
