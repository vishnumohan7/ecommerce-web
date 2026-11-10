/* eslint-disable local/no-jsx-literals -- Storefront copy is currently English-only. */
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ProductGrid } from '../../../components/product-card';
import { ageGateCookie, ageGateSessionCookie } from '../../../lib/age-gate';
import { serverApi, type Brand, type Category, type Product } from '../../../lib/store-api';

type SearchQuery = Record<string, string | string[] | undefined> & {
  id?: string;
  sort?: string;
  page?: string;
  brand?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  storage?: string | string[];
  dietary?: string | string[];
  rating?: string;
  offer?: string;
  view?: string;
};
interface SearchFacet {
  value: string;
  count: number;
}
interface SearchHit extends Product {
  dietaryTags?: string[];
  storageType?: string;
}
interface SearchResponse {
  items: SearchHit[];
  facets: Record<string, SearchFacet[]>;
  resultCount: number;
}
const PAGE_SIZE = 8;

function values(value: string | string[] | undefined) {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(',')).filter(Boolean);
}
function withQuery(
  pathname: string,
  query: SearchQuery,
  changes: Record<string, string | string[] | null>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === 'page' || value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) params.append(key, entry);
  }
  for (const [key, value] of Object.entries(changes)) {
    params.delete(key);
    if (value !== null)
      for (const entry of Array.isArray(value) ? value : [value]) params.append(key, entry);
  }
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
function toggleValue(current: string[], value: string) {
  return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
}
function facetCount(facets: SearchFacet[] | undefined, value: string) {
  return facets?.find((facet) => facet.value === value)?.count ?? 0;
}
function hiddenFields(query: SearchQuery, excluded: string[]) {
  return Object.entries(query).flatMap(([key, value]) =>
    excluded.includes(key) || value === undefined
      ? []
      : (Array.isArray(value) ? value : [value]).map((entry) => (
          <input key={`${key}-${entry}`} type="hidden" name={key} value={entry} />
        )),
  );
}

export default async function CategoryPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchQuery>;
}>) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [categories, brands] = await Promise.all([
    serverApi<{ items: Category[] }>('/api/v1/categories?limit=100'),
    serverApi<{ items: Brand[] }>('/api/v1/brands?limit=100'),
  ]);
  const current = categories?.items.find(
    (category) => category.id === query.id || category.slug === slug,
  );
  const categoryId = query.id ?? current?.id;
  const pathname = `/category/${slug}`;
  const brandIds = values(query.brand);
  const storageTypes = values(query.storage);
  const dietaryTags = values(query.dietary);
  const selectedBrands = (brands?.items ?? []).filter((brand) => brandIds.includes(brand.id));
  const headers = new Headers();
  const jar = await cookies();
  const ageToken = jar.get(ageGateCookie)?.value;
  const session = jar.get(ageGateSessionCookie)?.value;
  if (ageToken) headers.set('x-age-gate-token', ageToken);
  if (session) headers.set('x-session-id', session);

  const search = new URLSearchParams({ limit: '100', sort: query.sort ?? 'relevance' });
  if (categoryId && slug !== 'all') search.set('category', categoryId);
  if (brandIds.length) search.set('brand', brandIds.join(','));
  if (query.minPrice) search.set('minPriceMinor', String(Math.round(Number(query.minPrice) * 100)));
  if (query.maxPrice) search.set('maxPriceMinor', String(Math.round(Number(query.maxPrice) * 100)));
  if (query.inStock === 'true') search.set('inStock', 'true');
  if (storageTypes.length) search.set('storage', storageTypes.join(','));
  if (dietaryTags.length) search.set('dietary', dietaryTags.join(','));
  if (query.rating) search.set('minRatingBps', query.rating);
  if (query.offer === 'true') search.set('onOffer', 'true');

  const [result, globalFacets] = await Promise.all([
    serverApi<SearchResponse>(`/api/v1/search?${search.toString()}`, headers),
    serverApi<SearchResponse>('/api/v1/search?limit=1&sort=relevance', headers),
  ]);
  const products = result?.items ?? [];
  const resultCount = result?.resultCount ?? products.length;
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const page = Math.min(requestedPage, totalPages);
  const pageProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const firstResult = products.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = Math.min(page * PAGE_SIZE, products.length);
  const title = slug === 'all' ? 'All groceries' : (current?.name ?? slug.replaceAll('-', ' '));
  const categoryFacets = globalFacets?.facets.category;
  const brandFacets = result?.facets.brand;
  const resetHref = `${pathname}${categoryId ? `?id=${categoryId}` : ''}`;
  const activeFilters = [
    query.inStock === 'true' ? { label: 'In stock only', key: 'inStock' } : null,
    query.offer === 'true' ? { label: 'On offer', key: 'offer' } : null,
    query.minPrice || query.maxPrice
      ? { label: `£${query.minPrice || '0'} – £${query.maxPrice || 'any'}`, key: 'price' }
      : null,
    query.rating
      ? { label: `${(Number(query.rating) / 100).toFixed(1)}+ rating`, key: 'rating' }
      : null,
    ...selectedBrands.map((brand) => ({ label: brand.name, key: `brand:${brand.id}` })),
    ...storageTypes.map((storage) => ({ label: storage.toLowerCase(), key: `storage:${storage}` })),
    ...dietaryTags.map((tag) => ({ label: tag.toLowerCase(), key: `dietary:${tag}` })),
  ].filter((filter): filter is { label: string; key: string } => filter !== null);

  function removeFilter(key: string) {
    if (key === 'price') return withQuery(pathname, query, { minPrice: null, maxPrice: null });
    const [group, value] = key.split(':');
    if (group === 'brand')
      return withQuery(pathname, query, { brand: brandIds.filter((id) => id !== value) });
    if (group === 'storage')
      return withQuery(pathname, query, {
        storage: storageTypes.filter((entry) => entry !== value),
      });
    if (group === 'dietary')
      return withQuery(pathname, query, {
        dietary: dietaryTags.filter((entry) => entry !== value),
      });
    return withQuery(pathname, query, { [key]: null });
  }

  return (
    <main className="catalogue-page">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>{title}</strong>
      </div>
      <section className="catalogue-hero">
        <p className="eyebrow">Curated catalogue</p>
        <h1>{title}</h1>
        <p>Live availability and VAT-inclusive pricing from the current catalogue.</p>
      </section>
      <div className="catalogue-layout">
        <aside className="catalogue-filters">
          <div className="filter-title">
            <strong>☷ Filters</strong>
            <Link href={resetHref}>Reset all</Link>
          </div>
          <section>
            <h3>
              Category <span aria-hidden="true">⌃</span>
            </h3>
            {(categories?.items ?? []).slice(0, 12).map((category) => (
              <Link
                className={category.id === categoryId ? 'active' : ''}
                href={`/category/${category.slug}?id=${category.id}`}
                key={category.id}
              >
                <span>
                  {category.id === categoryId ? '✓ ' : ''}
                  {category.name}
                </span>
                <small>({facetCount(categoryFacets, category.name)})</small>
              </Link>
            ))}
          </section>
          <section>
            <h3>
              Price range <span aria-hidden="true">⌃</span>
            </h3>
            <div className="price-range-track">
              <span />
            </div>
            <form className="price-filter-form">
              {hiddenFields(query, ['minPrice', 'maxPrice', 'page'])}
              <label>
                £
                <input
                  name="minPrice"
                  inputMode="decimal"
                  placeholder="1.00"
                  defaultValue={query.minPrice}
                />
              </label>
              <span>to</span>
              <label>
                £
                <input
                  name="maxPrice"
                  inputMode="decimal"
                  placeholder="25.00"
                  defaultValue={query.maxPrice}
                />
              </label>
              <button type="submit">Apply price</button>
            </form>
          </section>
          <section>
            <h3>
              Availability &amp; diet <span aria-hidden="true">⌃</span>
            </h3>
            <Link
              className="filter-option"
              href={withQuery(pathname, query, {
                inStock: query.inStock === 'true' ? null : 'true',
              })}
            >
              <i className={query.inStock === 'true' ? 'checked' : ''} /> In stock only
            </Link>
            {['CHILLED', 'FROZEN'].map((storage) => (
              <Link
                className="filter-option"
                href={withQuery(pathname, query, { storage: toggleValue(storageTypes, storage) })}
                key={storage}
              >
                <i className={storageTypes.includes(storage) ? 'checked' : ''} />{' '}
                {storage === 'CHILLED' ? 'Chilled products' : 'Frozen products'}
              </Link>
            ))}
            <Link
              className="filter-option"
              href={withQuery(pathname, query, { dietary: toggleValue(dietaryTags, 'VEGAN') })}
            >
              <i className={dietaryTags.includes('VEGAN') ? 'checked' : ''} /> Vegan
            </Link>
          </section>
          <section>
            <h3>
              Brand <span aria-hidden="true">⌃</span>
            </h3>
            {(brands?.items ?? []).slice(0, 10).map((brand) => (
              <Link
                className="filter-option"
                href={withQuery(pathname, query, { brand: toggleValue(brandIds, brand.id) })}
                key={brand.id}
              >
                <i className={brandIds.includes(brand.id) ? 'checked' : ''} />
                <span>{brand.name}</span>
                <small>({facetCount(brandFacets, brand.name)})</small>
              </Link>
            ))}
          </section>
          <section>
            <h3>
              Customer rating <span aria-hidden="true">⌃</span>
            </h3>
            {[400, 500].map((rating) => (
              <Link
                className="filter-option"
                href={withQuery(pathname, query, {
                  rating: query.rating === String(rating) ? null : String(rating),
                })}
                key={rating}
              >
                <i className={query.rating === String(rating) ? 'checked' : ''} />
                <span className="rating-stars">★★★★★</span>{' '}
                {rating === 400 ? '4.0 & above' : '5.0 only'}
              </Link>
            ))}
          </section>
        </aside>
        <section className="catalogue-results">
          <div className="results-toolbar">
            <div className="active-filters">
              <span>Active:</span>
              {current && slug !== 'all' && <span className="filter-chip">{current.name}</span>}
              {activeFilters.map((filter) => (
                <Link className="filter-chip" href={removeFilter(filter.key)} key={filter.key}>
                  {filter.label} ×
                </Link>
              ))}
              {activeFilters.length > 0 && (
                <Link className="clear-filters" href={resetHref}>
                  Clear all
                </Link>
              )}
            </div>
            <div className="results-controls">
              <span>
                Showing {firstResult}–{lastResult}
                <br />
                of {resultCount}
              </span>
              <form>
                {hiddenFields(query, ['sort', 'page'])}
                <label>
                  Sort:
                  <select name="sort" defaultValue={query.sort ?? 'relevance'}>
                    <option value="relevance">Featured &amp; best selling</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="rating-desc">Top rated</option>
                    <option value="name-asc">Name A–Z</option>
                  </select>
                </label>
                <button className="button compact">Apply</button>
              </form>
              <Link
                aria-label="Grid view"
                className={`view-toggle ${query.view !== 'list' ? 'active' : ''}`}
                href={withQuery(pathname, query, { view: null })}
              >
                ▦
              </Link>
              <Link
                aria-label="List view"
                className={`view-toggle ${query.view === 'list' ? 'active' : ''}`}
                href={withQuery(pathname, query, { view: 'list' })}
              >
                ☷
              </Link>
            </div>
          </div>
          {result ? (
            <ProductGrid products={pageProducts} layout={query.view === 'list' ? 'list' : 'grid'} />
          ) : (
            <div className="error-state">Catalogue unavailable.</div>
          )}
          {result && products.length > 0 && (
            <nav className="catalogue-pagination" aria-label="Catalogue pages">
              <span>
                Page {page} of {totalPages} (Showing {firstResult}–{lastResult} of {products.length}{' '}
                items)
              </span>
              <div>
                <Link
                  className={page === 1 ? 'disabled' : ''}
                  href={withQuery(pathname, query, { page: String(Math.max(1, page - 1)) })}
                >
                  Previous
                </Link>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                  <Link
                    className={number === page ? 'active' : ''}
                    href={withQuery(pathname, query, { page: String(number) })}
                    key={number}
                  >
                    {number}
                  </Link>
                ))}
                <Link
                  className={page === totalPages ? 'disabled' : ''}
                  href={withQuery(pathname, query, {
                    page: String(Math.min(totalPages, page + 1)),
                  })}
                >
                  Next
                </Link>
              </div>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
