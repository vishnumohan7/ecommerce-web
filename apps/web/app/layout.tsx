import './theme.css';
import Link from 'next/link';
import { SiteHeader } from '../components/site-header';
import { CookieBanner } from '../components/cookie-banner';

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB"><body><SiteHeader />{children}
      <section className="service-promises" aria-label="Service promises">
        <div><span>▣</span><p><strong>Next-day UK delivery</strong><small>Tracked delivery options</small></p></div>
        <div><span>✣</span><p><strong>Chilled packing</strong><small>Carefully protected fresh goods</small></p></div>
        <div><span>◇</span><p><strong>Authentic products</strong><small>Carefully sourced ranges</small></p></div>
        <div><span>✓</span><p><strong>Responsible retail</strong><small>Challenge 25 for alcohol</small></p></div>
      </section>
      <footer className="site-footer">
        <div className="footer-brand"><strong>ANGADI</strong><em>A little bit of Kerala in every home</em><p>Groceries, fresh food, spices and drinks delivered across the United Kingdom.</p></div>
        <nav aria-label="Shop"><strong>Shop</strong><Link href="/category/all">All categories</Link><Link href="/category/groceries">Groceries</Link><Link href="/category/fresh-food">Fresh food</Link><Link href="/alcohol">Alcohol</Link><Link href="/offers">Offers</Link></nav>
        <nav aria-label="Customer service"><strong>Customer service</strong><Link href="/help/contact">Contact us</Link><Link href="/help/delivery">Delivery information</Link><Link href="/legal/returns">Returns &amp; refunds</Link><Link href="/legal/terms">Terms &amp; conditions</Link><Link href="/legal/privacy">Privacy policy</Link></nav>
        <div className="footer-social"><strong>Secure payments</strong><span>VISA</span><span>Mastercard</span><span>Apple Pay</span><span>Google Pay</span></div>
        <small>© 2026 Angadi. All rights reserved. UK-wide delivery.</small>
      </footer><CookieBanner />
    </body></html>
  );
}

export const metadata = { title: { default: 'Angadi', template: '%s — Angadi' }, description: 'Kerala and Indian groceries, fresh food and drinks delivered across the UK.' };
