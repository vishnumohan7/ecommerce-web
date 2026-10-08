'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { browserApi, money } from '../lib/store-api';

interface BasketHeader {
  currency: string;
  groups: Array<{ items: Array<{ quantity: number }> }>;
  totals: { grandTotalMinor: string };
}

export function SiteHeader() {
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
          <span>UK-wide delivery</span>
          <span>Free grocery delivery on qualifying orders</span>
          <span>Age-verified alcohol delivery</span>
        </div>
        <nav aria-label="Help links">
          <Link href="/help/contact">Help &amp; FAQ</Link>
          <Link href="/orders">Track order</Link>
        </nav>
      </div>
      <header className="site-header">
        <button
          className="menu-button"
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Open categories"
        >
          ☰
        </button>
        <Link className="brand" href="/" aria-label="Angadi home">
          <span aria-hidden="true">A</span>
          <strong>ANGADI</strong>
          <small>Kerala &amp; Indian groceries · drinks</small>
        </Link>
        <form className="header-search" action="/search">
          <label className="sr-only" htmlFor="site-search">Search products</label>
          <input id="site-search" name="q" type="search" placeholder="Search groceries, fresh food and drinks…" />
          <button type="submit">Search</button>
        </form>
        <nav className="account-nav" aria-label="Account and basket">
          <Link href="/profile"><span aria-hidden="true">◯</span><small>Namaskaram</small><strong>Account</strong></Link>
          <Link className="cart-link" href="/cart"><span aria-hidden="true">▣</span><small>Basket {basket.count > 0 ? `· ${basket.count}` : ''}</small><strong>{basket.total}</strong></Link>
        </nav>
      </header>
      <nav className={`category-nav ${open ? 'open' : ''}`} aria-label="Main navigation">
        <Link href="/category/all">All categories</Link>
        <Link href="/category/groceries">Groceries</Link>
        <Link href="/category/fresh-food">Fresh food</Link>
        <Link href="/category/frozen">Frozen</Link>
        <Link href="/category/rice-grains">Rice &amp; grains</Link>
        <Link href="/category/spices">Spices</Link>
        <Link href="/category/snacks">Snacks</Link>
        <Link href="/alcohol">Alcohol</Link>
        <Link className="offers-link" href="/offers">Offers</Link>
      </nav>
      <div className="trust-strip"><span>✓ Secure checkout</span><span>Temperature-controlled delivery</span><span>Prices include VAT</span></div>
    </>
  );
}
