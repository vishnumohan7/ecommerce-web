import Link from 'next/link';
import { ProductGrid } from '../components/product-card';
import { serverApi, type Category, type Product } from '../lib/store-api';

interface HomeContent {
  banners: Array<{ id: string; title: string; subtitle?: string | null; imageUrl: string; linkUrl?: string | null }>;
  blocks: Array<{ id: string; type: string; title?: string | null; content: unknown }>;
}

export default async function Home({ searchParams }: Readonly<{ searchParams: Promise<{ ageGate?: string }> }>) {
  const [{ ageGate }, products, categories, content] = await Promise.all([
    searchParams,
    serverApi<Product[]>('/api/v1/products?take=24'),
    serverApi<{ items: Category[] }>('/api/v1/categories?limit=12'),
    serverApi<HomeContent>('/api/v1/content/home'),
  ]);
  const banner = content?.banners[0];

  return <main className="storefront-home">
    {ageGate === 'declined' && <aside className="gate-notice" role="status">Alcohol browsing was closed. <Link href="/">Dismiss</Link></aside>}
    <section className={`home-hero${banner ? ' has-image' : ''}`} style={banner ? { backgroundImage: `linear-gradient(90deg, rgb(2 47 35 / 96%) 0%, rgb(2 47 35 / 78%) 42%, rgb(2 47 35 / 10%) 100%), url(${banner.imageUrl})` } : undefined}>
      <div>
        <p className="hero-kicker">Authentic South Asian provisions</p>
        <h1>{banner?.title ?? 'A little bit of Kerala in every home'}</h1>
        <p>{banner?.subtitle ?? 'Groceries, fresh food, spices and drinks delivered across the UK with careful fulfilment.'}</p>
        <div className="hero-actions"><Link className="button gold" href={banner?.linkUrl ?? '/category/all'}>Shop now →</Link><Link className="button outline-light" href="/category/all">Browse categories</Link></div>
      </div>
    </section>
    <section className="home-section category-section">
      <div className="section-heading"><div><h2>Explore everyday essentials</h2><p>Shop the live catalogue by category</p></div><Link href="/category/all">View all →</Link></div>
      <div className="category-orbits">{(categories?.items ?? []).slice(0, 8).map((category) => <Link key={category.id} href={`/category/${category.slug}?id=${category.id}`}><span style={category.imageUrl ? { backgroundImage: `url(${category.imageUrl})` } : undefined}>{!category.imageUrl && category.name.slice(0, 1)}</span><strong>{category.name}</strong></Link>)}</div>
    </section>
    <section className="home-section story-grid">
      <Link href="/category/fresh-food" className="story-card fresh"><small>Chilled selection</small><h2>Fresh food</h2><p>Browse chilled and fresh products available from the live catalogue.</p><b>Shop fresh food →</b></Link>
      <Link href="/category/all" className="story-card pantry"><small>Pantry essentials</small><h2>Groceries</h2><p>Rice, grains, spices, snacks and everyday household favourites.</p><b>Shop groceries →</b></Link>
      <Link href="/alcohol" className="story-card drinks"><small>18+ · drink responsibly</small><h2>Drinks</h2><p>Age-gated browsing and Challenge 25 controls at delivery.</p><b>Browse drinks →</b></Link>
    </section>
    <section className="home-section"><div className="section-heading"><div><p className="eyebrow">From the live catalogue</p><h2>Featured products</h2></div><Link href="/search">View all →</Link></div>{products ? <ProductGrid products={products.slice(0, 12)} /> : <div className="error-state"><h2>Catalogue unavailable</h2><p>Please try again shortly.</p></div>}</section>
    {content?.blocks.length ? <section className="home-section cms-blocks">{content.blocks.slice(0, 2).map((block) => <article key={block.id}><p className="eyebrow">{block.type.replaceAll('_', ' ')}</p>{block.title && <h2>{block.title}</h2>}<CmsBody content={block.content} /></article>)}</section> : null}
  </main>;
}

function CmsBody({ content }: Readonly<{ content: unknown }>) {
  if (typeof content === 'string') return <p>{content}</p>;
  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    const text = [record.description, record.text, record.body].find((value) => typeof value === 'string');
    if (typeof text === 'string') return <p>{text}</p>;
  }
  return null;
}
