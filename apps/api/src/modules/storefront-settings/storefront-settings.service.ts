import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';

type FooterLink = { label: string; href: string };

const shopLinks: FooterLink[] = [
  { label: 'All Categories', href: '/category/all' },
  { label: 'Groceries', href: '/category/groceries' },
  { label: 'Fresh Food', href: '/category/fresh-food' },
  { label: 'Frozen', href: '/category/frozen' },
  { label: 'Alcohol', href: '/alcohol' },
  { label: 'Offers', href: '/offers' },
];

const serviceLinks: FooterLink[] = [
  { label: 'Contact Us', href: '/help/contact' },
  { label: 'Delivery Information', href: '/help/delivery' },
  { label: 'Returns & Refunds', href: '/legal/returns' },
  { label: 'Terms & Conditions', href: '/legal/terms' },
  { label: 'Privacy Policy', href: '/legal/privacy' },
  { label: 'Responsible Drinking', href: '/help/responsible-drinking' },
];

@Injectable()
export class StorefrontSettingsService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async get() {
    const [storedSettings, branding] = await Promise.all([
      this.db.client.tenantSettings.findFirst(),
      this.db.client.brandingProfile.findFirst(),
    ]);
    const settings = this.record(storedSettings?.settings);
    const storefront = this.record(settings.storefront);
    const seo = this.record(settings.seo);
    const footer = this.record(settings.footer);
    const social = this.record(footer.social);
    const assets = this.record(branding?.assets);
    const storeName = this.text(storefront.storeName) || branding?.brandName || 'Angadi';

    return {
      storeName,
      tagline: this.text(storefront.tagline) || 'A little bit of Kerala in every home',
      supportEmail: this.text(storefront.supportEmail),
      supportPhone: this.text(storefront.supportPhone),
      locale: this.text(storefront.locale) || 'en-GB',
      currency: this.text(storefront.currency) || 'GBP',
      timezone: this.text(storefront.timezone) || 'Europe/London',
      logoUrl: this.text(assets.logoUrl),
      homepageTitle: this.text(seo.homepageTitle) || storeName,
      homepageMetaDescription:
        this.text(seo.homepageMetaDescription) ||
        'Kerala and Indian groceries, fresh food and drinks delivered across the UK.',
      footer: {
        description:
          this.text(footer.description) ||
          'Delivering authentic South Asian groceries, fresh coastal produce, spices and traditional beverages direct to doors across the United Kingdom.',
        copyright:
          this.text(footer.copyright) ||
          `© ${String(new Date().getFullYear())} ${storeName}. All rights reserved. UK Wide Delivery | Fresh. Authentic. Always.`,
        bottomText:
          this.text(footer.bottomText) ||
          'Kerala & Indian Groceries & Drinks Delivered Across the UK',
        social: {
          instagram: this.externalUrl(social.instagram),
          facebook: this.externalUrl(social.facebook),
          youtube: this.externalUrl(social.youtube),
        },
        shopLinks: this.links(footer.shopLinks, shopLinks),
        serviceLinks: this.links(footer.serviceLinks, serviceLinks),
      },
    };
  }

  private links(value: unknown, fallback: FooterLink[]): FooterLink[] {
    if (!Array.isArray(value)) return fallback;
    const links = value.flatMap((item) => {
      const link = this.record(item);
      const label = this.text(link.label);
      const href = this.text(link.href);
      const safeHref = href.startsWith('/') ? href : this.externalUrl(href);
      return label && safeHref ? [{ label, href: safeHref }] : [];
    });
    return links.length ? links : fallback;
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
  }

  private text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private externalUrl(value: unknown): string {
    const url = this.text(value);
    return /^https:\/\//i.test(url) ? url : '';
  }
}
