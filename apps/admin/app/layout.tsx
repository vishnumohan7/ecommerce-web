/* eslint-disable local/no-jsx-literals -- Milestone 17 preview copy is English-only until the localisation catalogue lands. */
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './theme.css';
import './orders/orders.css';

export const metadata: Metadata = {
  title: { default: 'Denes Commerce — Admin', template: '%s — Denes Admin' },
  description: 'Operations console for the Denes grocery and alcohol commerce platform.',
};

const navigation = [
  { href: '/', label: 'Overview', icon: 'grid' },
  { href: '/products', label: 'Products', icon: 'box' },
  { href: '/catalogue', label: 'Categories & brands', icon: 'layers' },
  { href: '/orders', label: 'Orders', icon: 'orders' },
  { href: '/delivery', label: 'Delivery', icon: 'truck' },
  { href: '/pricing', label: 'Pricing & tax', icon: 'promo' },
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
              <p className="nav-caption nav-caption-spaced">Coming online</p>
              <span className="nav-disabled">
                <NavIcon name="users" />
                Customers <em>Planned</em>
              </span>
            </nav>
            <div className="sidebar-foot">
              <span className="status-dot" />
              <span>
                <strong>Preview track</strong>
                <small>Milestone 17 in progress</small>
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
                <span className="preview-pill">Read-only preview</span>
                <span className="avatar" aria-hidden="true">
                  DA
                </span>
                <span className="operator">
                  <strong>Admin preview</strong>
                  <small>Operations</small>
                </span>
              </div>
            </header>
            <main className="content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
