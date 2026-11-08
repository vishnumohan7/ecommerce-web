import './theme.css';

/* eslint-disable local/no-jsx-literals */

import Link from 'next/link';
import { SiteHeader } from '../components/site-header';
import { CookieBanner } from '../components/cookie-banner';

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body id="top">
        <SiteHeader />
        {children}
        <section className="service-promises" aria-label="Service promises">
          <div>
            <span>▣</span>
            <p>
              <strong>Next-day UK delivery</strong>
              <small>Tracked delivery options</small>
            </p>
          </div>
          <div>
            <span>✣</span>
            <p>
              <strong>Chilled packing</strong>
              <small>Carefully protected fresh goods</small>
            </p>
          </div>
          <div>
            <span>◇</span>
            <p>
              <strong>Authentic products</strong>
              <small>Carefully sourced ranges</small>
            </p>
          </div>
          <div>
            <span>✓</span>
            <p>
              <strong>Responsible retail</strong>
              <small>Challenge 25 for alcohol</small>
            </p>
          </div>
        </section>
        <footer className="site-footer">
          <div className="footer-brand">
            <div className="footer-logo">
              <span aria-hidden="true" />
              <strong>ANGADI</strong>
            </div>
            <em>A little bit of Kerala in every home</em>
            <p>
              Delivering authentic South Asian groceries, fresh coastal produce,
              <br className="footer-copy-break" /> spices and traditional beverages direct to doors
              across the United Kingdom.
            </p>
          </div>
          <nav aria-label="Shop">
            <strong>Shop</strong>
            <Link href="/category/all">All Categories</Link>
            <Link href="/category/groceries">Groceries</Link>
            <Link href="/category/fresh-food">Fresh Food</Link>
            <Link href="/category/frozen">Frozen</Link>
            <Link href="/alcohol">Alcohol</Link>
            <Link href="/offers">Offers</Link>
          </nav>
          <div className="footer-bottom">
            <small>
              © 2026 Angadi. All rights reserved. UK Wide Delivery | Fresh. Authentic. Always.
            </small>
            <a className="back-to-top" href="#top" aria-label="Back to top">
              ↑
            </a>
          </div>
        </footer>
        <CookieBanner />
      </body>
    </html>
  );
}

export const metadata = {
  title: { default: 'Angadi', template: '%s — Angadi' },
  description: 'Kerala and Indian groceries, fresh food and drinks delivered across the UK.',
};
