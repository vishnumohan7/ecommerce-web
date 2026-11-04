'use client';

/* eslint-disable local/no-jsx-literals */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { browserApi, money } from '../lib/store-api';

interface BasketHeader {
  currency: string;
  groups: Array<{ items: Array<{ quantity: number }> }>;
  totals: { grandTotalMinor: string };
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [basket, setBasket] = useState({ count: 0, total: '£0.00' });

  useEffect(() => {
    void browserApi<BasketHeader>('/api/v1/cart')
      .then((cart) => {
        const count = cart.groups.reduce(
          (total, group) => total + group.items.reduce((sum, item) => sum + item.quantity, 0),
          0,
        );
        setBasket({ count, total: money(cart.totals.grandTotalMinor, cart.currency) });
      })
      .catch(() => undefined);
  }, []);

  return (
    <>
      <div className="utility-strip">
        <div>
          <span>
            <i aria-hidden="true">▣</i> UK Wide Delivery
          </span>
          <span>
            <i aria-hidden="true">♧</i> Free Grocery Delivery on orders over £40
          </span>
          <span>
            <i aria-hidden="true">ϟ</i> Chilled / Frozen Packing Fee £1.99
          </span>
          <span>
            <i aria-hidden="true">▰</i> Alcohol Delivery £5.99 (Weekdays)
          </span>
        </div>
        <nav aria-label="Help links">
          <Link href="/help/contact">Help &amp; FAQ</Link>
          <span aria-hidden="true">•</span>
          <Link href="/orders">Track Order</Link>
        </nav>
      </div>
      <header className="site-header">
        <button
          className="menu-button"
          type="button"
          onClick={() => {
            setOpen((value) => !value);
          }}
          aria-expanded={open}
          aria-label="Open categories"
        >
          ☰
        </button>
        <Link className="brand" href="/" aria-label="Angadi home">
          <span aria-hidden="true" />
          <strong>ANGADI</strong>
          <small>Kerala &amp; Indian groceries · drinks</small>
        </Link>
        <form className="header-search" action="/search">
          <label className="sr-only" htmlFor="site-search">
            Search products
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search matta rice, curry leaves, beef roast masala, old monk…"
          />
          <button type="submit" aria-label="Search">
            ⌕
          </button>
        </form>
        <nav className="account-nav" aria-label="Account and basket">
          <Link href="/profile">
            <span className="account-icon" aria-hidden="true">
              ♙
            </span>
            <small>Namaskaram</small>
            <strong>Account</strong>
          </Link>
          <Link className="cart-link" href="/cart">
            <span className="basket-icon" aria-hidden="true">
              ♨{basket.count > 0 && <b>{basket.count}</b>}
            </span>
            <small>Basket</small>
            <strong>{basket.total}</strong>
          </Link>
        </nav>
      </header>
      <nav className={`category-nav ${open ? 'open' : ''}`} aria-label="Main navigation">
        <Link className="all-categories" href="/category/all">
          <span aria-hidden="true">☰</span> All categories <span aria-hidden="true">⌄</span>
        </Link>
        <Link
          className={pathname === '/category/groceries' ? 'active' : undefined}
          href="/category/groceries"
        >
          Groceries
        </Link>
        <Link
          className={pathname === '/category/fresh-food' ? 'active' : undefined}
          href="/category/fresh-food"
        >
          Fresh Food
        </Link>
        <Link
          className={pathname === '/category/frozen' ? 'active' : undefined}
          href="/category/frozen"
        >
          Frozen
        </Link>
        <Link
          className={pathname === '/category/rice-grains' ? 'active' : undefined}
          href="/category/rice-grains"
        >
          Rice &amp; Grains
        </Link>
        <Link
          className={pathname === '/category/spices' ? 'active' : undefined}
          href="/category/spices"
        >
          Spices
        </Link>
        <Link
          className={pathname === '/category/snacks' ? 'active' : undefined}
          href="/category/snacks"
        >
          Snacks
        </Link>
        <Link
          className={pathname === '/category/beverages' ? 'active' : undefined}
          href="/category/beverages"
        >
          Beverages
        </Link>
        <Link className={pathname === '/alcohol' ? 'active' : undefined} href="/alcohol">
          Alcohol
        </Link>
        <Link className="offers-link" href="/offers">
          Offers
        </Link>
      </nav>
    </>
  );
}
