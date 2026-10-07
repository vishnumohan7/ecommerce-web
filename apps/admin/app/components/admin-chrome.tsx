'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { adminLogout } from '../auth-actions';

type IconName =
  | 'dashboard'
  | 'product'
  | 'catalogue'
  | 'inventory'
  | 'promotion'
  | 'orders'
  | 'returns'
  | 'delivery'
  | 'pricing'
  | 'customers'
  | 'reviews'
  | 'content'
  | 'notifications'
  | 'reports'
  | 'access'
  | 'settings'
  | 'audit'
  | 'privacy'
  | 'system';
type Item = { href: string; label: string; icon: IconName };
const groups: Array<{ label: string; items: Item[] }> = [
  {
    label: 'Commerce',
    items: [
      { href: '/', label: 'Dashboard', icon: 'dashboard' },
      { href: '/products', label: 'Products', icon: 'product' },
      { href: '/categories', label: 'Categories', icon: 'catalogue' },
      { href: '/brands', label: 'Brands', icon: 'catalogue' },
      { href: '/inventory', label: 'Inventory', icon: 'inventory' },
      { href: '/promotions', label: 'Promotions', icon: 'promotion' },
      { href: '/orders', label: 'Orders', icon: 'orders' },
      { href: '/returns', label: 'Returns & refunds', icon: 'returns' },
      { href: '/delivery', label: 'Delivery', icon: 'delivery' },
      { href: '/pricing', label: 'Pricing & tax', icon: 'pricing' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/customers', label: 'Customer accounts', icon: 'customers' },
      { href: '/reviews', label: 'Reviews', icon: 'reviews' },
      { href: '/content', label: 'Content & banners', icon: 'content' },
      { href: '/notifications', label: 'Notifications', icon: 'notifications' },
      { href: '/reports', label: 'Reports', icon: 'reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/access', label: 'Roles & permissions', icon: 'access' },
      { href: '/settings', label: 'Settings & branding', icon: 'settings' },
      { href: '/audit', label: 'Audit logs', icon: 'audit' },
      { href: '/privacy', label: 'GDPR requests', icon: 'privacy' },
      { href: '/system', label: 'System health', icon: 'system' },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function TablePaginationManager() {
  const pathname = usePathname();
  useEffect(() => {
    const setup = (table: HTMLTableElement) => {
      if (table.dataset.paginated === 'true') return;
      const body = table.tBodies.item(0);
      if (!body || body.rows.length <= 10) return;
      table.dataset.paginated = 'true';
      let page = 1;
      let pageSize = 10;
      const rows = Array.from(body.rows);
      const pager = document.createElement('nav');
      pager.className = 'table-pagination';
      pager.setAttribute('aria-label', 'Table pagination');
      const summary = document.createElement('span');
      const controls = document.createElement('div');
      const sizeLabel = document.createElement('label');
      sizeLabel.textContent = 'Rows ';
      const size = document.createElement('select');
      for (const value of [10, 25, 50]) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = String(value);
        size.append(option);
      }
      sizeLabel.append(size);
      const previous = document.createElement('button');
      previous.type = 'button';
      previous.textContent = 'Previous';
      const current = document.createElement('strong');
      const next = document.createElement('button');
      next.type = 'button';
      next.textContent = 'Next';
      controls.append(sizeLabel, previous, current, next);
      pager.append(summary, controls);
      const wrap = table.closest('.table-wrap');
      (wrap ?? table).insertAdjacentElement('afterend', pager);
      const render = () => {
        const pages = Math.max(1, Math.ceil(rows.length / pageSize));
        page = Math.min(page, pages);
        const start = (page - 1) * pageSize;
        rows.forEach((row, index) => {
          row.hidden = index < start || index >= start + pageSize;
        });
        summary.textContent = `Showing ${start + 1}–${Math.min(start + pageSize, rows.length)} of ${rows.length}`;
        current.textContent = `${page} / ${pages}`;
        previous.disabled = page === 1;
        next.disabled = page === pages;
      };
      previous.addEventListener('click', () => {
        page -= 1;
        render();
        table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      next.addEventListener('click', () => {
        page += 1;
        render();
        table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      size.addEventListener('change', () => {
        pageSize = Number(size.value);
        page = 1;
        render();
      });
      render();
    };
    const scan = () => document.querySelectorAll<HTMLTableElement>('.content table').forEach(setup);
    scan();
    const observer = new MutationObserver(scan);
    const content = document.querySelector('.content');
    if (content) observer.observe(content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}

const iconPaths: Record<IconName, string[]> = {
  dashboard: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  product: ['M12 3 21 8 12 13 3 8z', 'M3 8v8l9 5 9-5V8', 'M12 13v8'],
  catalogue: ['M4 5h16v5H4z', 'M4 14h7v5H4z', 'M15 14h5v5h-5z'],
  inventory: ['M4 6h16v14H4z', 'M8 6V4h8v2', 'M8 11h8'],
  promotion: ['M4 7h10l6 5-6 5H4z', 'M8 10h.01'],
  orders: ['M6 4h12v16H6z', 'M9 8h6', 'M9 12h6', 'M9 16h4'],
  returns: ['M9 7 4 12l5 5', 'M5 12h9a6 6 0 0 1 6 6'],
  delivery: [
    'M3 6h11v10H3z',
    'M14 10h4l3 3v3h-7z',
    'M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
    'M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  ],
  pricing: [
    'M12 3v18',
    'M16 7.5c0-2-1.8-3.5-4-3.5S8 5.3 8 7c0 4 8 2 8 6 0 1.7-1.8 3-4 3.5S8 15 8 13',
  ],
  customers: [
    'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M17 11a4 4 0 0 0 0-8',
    'M22 20v-2a4 4 0 0 0-3-3.87',
  ],
  reviews: ['m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z'],
  content: ['M4 5h16v14H4z', 'm4 15 4-4 4 4 3-3 5 5', 'M15 9h.01'],
  notifications: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  reports: ['M5 19V9', 'M12 19V5', 'M19 19v-7', 'M3 19h18'],
  access: ['M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z', 'M9 12l2 2 4-4'],
  settings: [
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
    'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-3v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 14.7a1.7 1.7 0 0 0-1.55-1H5v-3h.09a1.7 1.7 0 0 0 1.55-1A1.7 1.7 0 0 0 6.3 7.8l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 10.3 6a1.7 1.7 0 0 0 1-1.55V4h3v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19 9.3a1.7 1.7 0 0 0 1.55 1H21v3h-.09a1.7 1.7 0 0 0-1.51 1.7z',
  ],
  audit: ['M5 4h14v16H5z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  privacy: ['M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z'],
  system: ['M3 12h4l2-5 4 10 2-5h6'],
};

function NavIcon({ name }: { name: IconName }) {
  return (
    <svg
      className="nav-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name].map((path, index) => (
        <path d={path} key={index} />
      ))}
    </svg>
  );
}

export function AdminChrome({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  useEffect(() => setNavigatingTo(null), [pathname]);
  if (pathname === '/login') return <>{children}</>;
  const item = groups
    .flatMap((group) => group.items)
    .find((entry) => isActive(pathname, entry.href));
  const title = item?.label ?? 'Dashboard';
  return (
    <div className="admin-shell larkon-shell">
      <aside className="sidebar larkon-sidebar" aria-label="Primary navigation">
        <Link className="brand" href="/">
          <span className="brand-mark">D</span>
          <span>
            <strong>DENES</strong>
            <small>COMMERCE ADMIN</small>
          </span>
        </Link>
        <nav className="desktop-nav">
          {groups.map((group) => (
            <section className="nav-group" key={group.label}>
              <p className="nav-caption">{group.label}</p>
              {group.items.map((entry) => (
                <Link
                  className={isActive(pathname, entry.href) ? 'active' : undefined}
                  href={entry.href}
                  key={entry.href}
                  onClick={() => {
                    if (!isActive(pathname, entry.href)) setNavigatingTo(entry.href);
                  }}
                  onFocus={() => router.prefetch(entry.href)}
                  onMouseEnter={() => router.prefetch(entry.href)}
                >
                  <span className="larkon-nav-icon">
                    <NavIcon name={entry.icon} />
                  </span>
                  <span>{entry.label}</span>
                  {navigatingTo === entry.href && (
                    <span className="nav-loading" aria-hidden="true" />
                  )}
                  <i aria-hidden="true" />
                </Link>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" />
          <span>
            <strong>Connected</strong>
            <small>Production database</small>
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar larkon-topbar">
          <details className="mobile-menu">
            <summary aria-label="Open navigation">
              <span />
              <span />
              <span />
            </summary>
            <nav>
              {groups
                .flatMap((group) => group.items)
                .map((entry) => (
                  <Link href={entry.href} key={entry.href}>
                    {entry.label}
                  </Link>
                ))}
            </nav>
          </details>
          <div className="topbar-title">
            <span>Operations</span>
            <strong>{title}</strong>
          </div>
          <form className="global-search" action="/products" role="search">
            <span aria-hidden="true" />
            <label className="sr-only" htmlFor="global-search">
              Search products
            </label>
            <input id="global-search" name="q" placeholder="Search products and SKUs" />
          </form>
          <div className="topbar-actions">
            <Link className="icon-button" href="/notifications" aria-label="Notifications">
              <NavIcon name="notifications" />
            </Link>
            <details className="profile-menu">
              <summary>
                <span className="avatar">DA</span>
                <span className="operator">
                  <strong>Administrator</strong>
                  <small>Operations</small>
                </span>
                <span className="chevron">⌄</span>
              </summary>
              <div>
                <form action={adminLogout}>
                  <button type="submit">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main className="content">
          <div className="page-breadcrumb">
            <span>Admin</span>
            <b>/</b>
            <strong>{title}</strong>
          </div>
          {children}
          <TablePaginationManager />
        </main>
      </div>
    </div>
  );
}
