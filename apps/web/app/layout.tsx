import './theme.css';

/* eslint-disable local/no-jsx-literals */

import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '../components/site-header';
import { CookieBanner } from '../components/cookie-banner';
import { serverApi, type StorefrontSettings } from '../lib/store-api';

export default async function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await serverApi<StorefrontSettings>('/api/v1/storefront/settings');
  const footer = settings?.footer;
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
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="" aria-hidden="true" />
              ) : (
                <span aria-hidden="true" />
              )}
              <strong>{settings?.storeName ?? 'ANGADI'}</strong>
            </div>
            <em>{settings?.tagline ?? 'A little bit of Kerala in every home'}</em>
            <p>{footer?.description ?? defaultDescription}</p>
          </div>
          <nav aria-label="Shop">
            <strong>Shop</strong>
            {(footer?.shopLinks ?? defaultShopLinks).map((link) => (
              <FooterLink href={link.href} key={`${link.label}-${link.href}`}>
                {link.label}
              </FooterLink>
            ))}
          </nav>
          <nav aria-label="Customer service">
            <strong>Customer service</strong>
            {(footer?.serviceLinks ?? defaultServiceLinks).map((link) => (
              <FooterLink href={link.href} key={`${link.label}-${link.href}`}>
                {link.label}
              </FooterLink>
            ))}
          </nav>
          <div className="footer-connect">
            <strong>Follow us</strong>
            <div className="footer-social" aria-label="Social media">
              {footer?.social.instagram ? (
                <SocialLink href={footer.social.instagram} label="Instagram">
                  ◎
                </SocialLink>
              ) : null}
              {footer?.social.facebook ? (
                <SocialLink href={footer.social.facebook} label="Facebook">
                  f
                </SocialLink>
              ) : null}
              {footer?.social.youtube ? (
                <SocialLink href={footer.social.youtube} label="YouTube">
                  ▶
                </SocialLink>
              ) : null}
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
            <small>{footer?.copyright ?? defaultCopyright}</small>
            <div>
              <small>{footer?.bottomText ?? defaultBottomText}</small>
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

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return /^https?:\/\//.test(href) ? (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <Link href={href}>{children}</Link>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
      {children}
    </a>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await serverApi<StorefrontSettings>('/api/v1/storefront/settings');
  const storeName = settings?.storeName ?? 'Angadi';
  return {
    title: { default: settings?.homepageTitle ?? storeName, template: `%s — ${storeName}` },
    description:
      settings?.homepageMetaDescription ??
      'Kerala and Indian groceries, fresh food and drinks delivered across the UK.',
  };
}

const defaultDescription =
  'Delivering authentic South Asian groceries, fresh coastal produce, spices and traditional beverages direct to doors across the United Kingdom.';
const defaultCopyright =
  '© 2026 Angadi. All rights reserved. UK Wide Delivery | Fresh. Authentic. Always.';
const defaultBottomText = 'Kerala & Indian Groceries & Drinks Delivered Across the UK';
const defaultShopLinks = [
  { label: 'All Categories', href: '/category/all' },
  { label: 'Groceries', href: '/category/groceries' },
  { label: 'Fresh Food', href: '/category/fresh-food' },
  { label: 'Frozen', href: '/category/frozen' },
  { label: 'Alcohol', href: '/alcohol' },
  { label: 'Offers', href: '/offers' },
];
const defaultServiceLinks = [
  { label: 'Contact Us', href: '/help/contact' },
  { label: 'Delivery Information', href: '/help/delivery' },
  { label: 'Returns & Refunds', href: '/legal/returns' },
  { label: 'Terms & Conditions', href: '/legal/terms' },
  { label: 'Privacy Policy', href: '/legal/privacy' },
  { label: 'Responsible Drinking', href: '/help/responsible-drinking' },
];
