'use client';

import Link from 'next/link';
import { useState } from 'react';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="service-strip">Free delivery on qualifying orders · Prices include VAT</div>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Denes home"><span>D</span> Denes Market</Link>
        <form className="header-search" action="/search">
          <label className="sr-only" htmlFor="site-search">Search products</label>
          <input id="site-search" name="q" type="search" placeholder="Search groceries and drinks" />
          <button type="submit">Search</button>
        </form>
        <nav aria-label="Account and basket">
          <Link href="/orders">Orders</Link><Link href="/wishlist">Wishlist</Link><Link className="cart-link" href="/cart">Basket</Link>
        </nav>
        <button className="menu-button" type="button" onClick={() => setOpen(!open)} aria-expanded={open}>Menu</button>
      </header>
      <nav className={`category-nav ${open ? 'open' : ''}`} aria-label="Main navigation">
        <Link href="/category/all">Groceries</Link><Link href="/alcohol">Beer, wine & spirits</Link><Link href="/offers">Offers</Link><Link href="/brands/all">Brands</Link><Link href="/help/delivery">Help</Link><Link href="/profile">My account</Link>
      </nav>
    </>
  );
}
