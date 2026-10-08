import Link from 'next/link';
import { ProductGrid } from '../../../components/product-card';
import { serverApi, type Brand, type Category, type Product } from '../../../lib/store-api';

export default async function CategoryPage({ params, searchParams }: Readonly<{ params: Promise<{ slug: string }>; searchParams: Promise<{ id?: string; sort?: string }> }>) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [categories, brands] = await Promise.all([
    serverApi<{ items: Category[] }>('/api/v1/categories?limit=100'),
    serverApi<{ items: Brand[] }>('/api/v1/brands?limit=100'),
  ]);
  const current = categories?.items.find((category) => category.id === query.id || category.slug === slug);
  const categoryId = query.id ?? current?.id;
  const path = categoryId ? `/api/v1/products?categoryId=${encodeURIComponent(categoryId)}&take=100` : '/api/v1/products?take=100';
  const products = await serverApi<Product[]>(path);
  const title = slug === 'all' ? 'All groceries' : current?.name ?? slug.replaceAll('-', ' ');
  const sorted = [...(products ?? [])].sort((left, right) => query.sort === 'price-low' ? Number(left.priceMinor) - Number(right.priceMinor) : query.sort === 'price-high' ? Number(right.priceMinor) - Number(left.priceMinor) : left.name.localeCompare(right.name));

  return <main className="catalogue-page">
    <div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><strong>{title}</strong></div>
    <section className="catalogue-hero"><p className="eyebrow">Curated catalogue</p><h1>{title}</h1><p>Live availability and VAT-inclusive pricing from the current catalogue.</p></section>
    <div className="catalogue-layout">
      <aside className="catalogue-filters">
        <div className="filter-title"><strong>Filters</strong><Link href={`/category/${slug}${categoryId ? `?id=${categoryId}` : ''}`}>Reset</Link></div>
        <section><h3>Category</h3>{(categories?.items ?? []).slice(0, 12).map((category) => <Link className={category.id === categoryId ? 'active' : ''} href={`/category/${category.slug}?id=${category.id}`} key={category.id}>{category.name}</Link>)}</section>
        <section><h3>Brand</h3>{(brands?.items ?? []).slice(0, 8).map((brand) => <Link href={`/brands/${brand.slug}`} key={brand.id}>{brand.name}</Link>)}</section>
        <section><h3>Customer rating</h3><span>★★★★★ 4.0 and above</span></section>
      </aside>
      <section className="catalogue-results">
        <div className="results-toolbar"><p>Showing <strong>{sorted.length}</strong> products</p><form><input type="hidden" name="id" value={categoryId ?? ''} /><label>Sort <select name="sort" defaultValue={query.sort ?? 'name'}><option value="name">Name</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label><button className="button compact">Apply</button></form></div>
        {products ? <ProductGrid products={sorted} /> : <div className="error-state">Catalogue unavailable.</div>}
      </section>
    </div>
  </main>;
}
