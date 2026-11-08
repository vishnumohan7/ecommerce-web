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
          <nav aria-label="Customer service">
            <strong>Customer service</strong>
            <Link href="/help/contact">Contact Us</Link>
            <Link href="/help/delivery">Delivery Information</Link>
            <Link href="/legal/returns">Returns &amp; Refunds</Link>
            <Link href="/legal/terms">Terms &amp; Conditions</Link>
            <Link href="/legal/privacy">Privacy Policy</Link>
            <Link href="/help/responsible-drinking">Responsible Drinking</Link>
          </nav>
          <div className="footer-connect">
            <strong>Follow us</strong>
            <div className="footer-social" aria-label="Social media">
              <a href="#" aria-label="Instagram">
                ◎
              </a>
              <a href="#" aria-label="Facebook">
                f
              </a>
              <a href="#" aria-label="YouTube">
                ▶
              </a>
            </div>
            <strong className="payment-heading">Secure payments</strong>
            <div className="payment-badges" aria-label="Accepted payment methods">
              <span>VISA</span>
              <span>Mastercard</span>
              <span>Apple Pay</span>
              <span>Google Pay</span>
              <span>Stripe</span>
            </div>
          </div>
          <div className="footer-bottom">
            <small>
              © 2026 Angadi. All rights reserved. UK Wide Delivery | Fresh. Authentic. Always.
            </small>
            <div>
              <small>Kerala &amp; Indian Groceries &amp; Drinks Delivered Across the UK</small>
              <a className="back-to-top" href="#top" aria-label="Back to top">
                ↑
              </a>
            </div>
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
