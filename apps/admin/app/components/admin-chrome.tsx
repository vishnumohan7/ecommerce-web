'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { adminLogout } from '../auth-actions';

type Item = { href: string; label: string; icon: string };
const groups: Array<{ label: string; items: Item[] }> = [
  { label: 'Commerce', items: [
    { href: '/', label: 'Dashboard', icon: '▦' }, { href: '/products', label: 'Products', icon: '◇' },
    { href: '/catalogue', label: 'Categories & brands', icon: '▱' }, { href: '/inventory', label: 'Inventory', icon: '▣' },
    { href: '/promotions', label: 'Promotions', icon: '⌁' }, { href: '/orders', label: 'Orders', icon: '▤' },
    { href: '/returns', label: 'Returns & refunds', icon: '↩' }, { href: '/delivery', label: 'Delivery', icon: '▰' },
    { href: '/pricing', label: 'Pricing & tax', icon: '£' },
  ] },
  { label: 'Customers', items: [
    { href: '/customers', label: 'Customer accounts', icon: '○' }, { href: '/reviews', label: 'Reviews', icon: '☆' },
    { href: '/content', label: 'Content & banners', icon: '▧' }, { href: '/notifications', label: 'Notifications', icon: '◌' },
    { href: '/reports', label: 'Reports', icon: '⌁' },
  ] },
  { label: 'Administration', items: [
    { href: '/access', label: 'Roles & permissions', icon: '◉' }, { href: '/settings', label: 'Settings & branding', icon: '⚙' },
    { href: '/audit', label: 'Audit logs', icon: '≡' }, { href: '/privacy', label: 'GDPR requests', icon: '♢' },
    { href: '/license', label: 'Licence', icon: '▥' }, { href: '/system', label: 'System health', icon: '⌁' },
  ] },
];

function isActive(pathname: string, href: string): boolean { return href === '/' ? pathname === '/' : pathname.startsWith(href); }

export function AdminChrome({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  if (pathname === '/login') return <>{children}</>;
  const item = groups.flatMap((group) => group.items).find((entry) => isActive(pathname, entry.href));
  const title = item?.label ?? 'Dashboard';
  return <div className="admin-shell larkon-shell">
    <aside className="sidebar larkon-sidebar" aria-label="Primary navigation">
      <Link className="brand" href="/"><span className="brand-mark">D</span><span><strong>DENES</strong><small>COMMERCE ADMIN</small></span></Link>
      <nav className="desktop-nav">{groups.map((group) => <section className="nav-group" key={group.label}><p className="nav-caption">{group.label}</p>{group.items.map((entry) => <Link className={isActive(pathname, entry.href) ? 'active' : undefined} href={entry.href} key={entry.href}><span className="larkon-nav-icon" aria-hidden="true">{entry.icon}</span><span>{entry.label}</span><i aria-hidden="true"/></Link>)}</section>)}</nav>
      <div className="sidebar-foot"><span className="status-dot"/><span><strong>Connected</strong><small>Production database</small></span></div>
    </aside>
    <div className="workspace">
      <header className="topbar larkon-topbar">
        <details className="mobile-menu"><summary aria-label="Open navigation"><span/><span/><span/></summary><nav>{groups.flatMap((group) => group.items).map((entry) => <Link href={entry.href} key={entry.href}>{entry.label}</Link>)}</nav></details>
        <div className="topbar-title"><span>Operations</span><strong>{title}</strong></div>
        <form className="global-search" action="/products" role="search"><span aria-hidden="true"/><label className="sr-only" htmlFor="global-search">Search products</label><input id="global-search" name="q" placeholder="Search products and SKUs"/></form>
        <div className="topbar-actions"><Link className="icon-button" href="/notifications" aria-label="Notifications">◌</Link><details className="profile-menu"><summary><span className="avatar">DA</span><span className="operator"><strong>Administrator</strong><small>Operations</small></span><span className="chevron">⌄</span></summary><div><form action={adminLogout}><button type="submit">Sign out</button></form></div></details></div>
      </header>
      <main className="content"><div className="page-breadcrumb"><span>Admin</span><b>/</b><strong>{title}</strong></div>{children}</main>
    </div>
  </div>;
}
