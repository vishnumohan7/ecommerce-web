import type { MetadataRoute } from 'next';
const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
export default function sitemap(): MetadataRoute.Sitemap { return ['', '/category/all', '/search', '/offers', '/brands/all', '/help/delivery', '/legal/terms', '/legal/privacy', '/legal/cookies'].map((path) => ({ url: `${base}${path}`, changeFrequency: path === '' ? 'daily' : 'weekly' })); }
