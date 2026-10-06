import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: '*', allow: '/', disallow: ['/checkout', '/orders', '/profile', '/addresses', '/wishlist', '/alcohol', '/category/alcohol'] }], sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'}/sitemap.xml` }; }
