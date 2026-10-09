/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { deleteProduct } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { ConfirmSubmitButton } from '../components/confirm-submit-button';
import { Currency } from '../components/currency';
import { TablePagination } from '../components/table-pagination';
import { fetchAdminProducts } from '../lib/api';

export const metadata: Metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string; status?: string; sort?: string; success?: string; error?: string }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const page = Math.max(1, Number(params.page) || 1);
  const status = typeof params.status === 'string' ? params.status : '';
  const sort = typeof params.sort === 'string' ? params.sort : 'updated-desc';
  const result = await fetchAdminProducts({ page, q, status, sort });
  const products = result.ok ? result.data.items : [];
  const resultCount = result.ok ? result.data.total : 0;

  return (
    <>
      <section className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Products</h1>
          <p>Inspect live product, compliance and pricing data from the commerce API.</p>
        </div>
        <div className="heading-actions">
          <Link className="button button-muted" href="/products/import">Import CSV / Excel</Link>
          <Link className="button button-primary" href="/products/new">+ Add product</Link>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      <article className="panel">
        <div className="catalog-toolbar">
          <form action="/products" role="search" className="catalog-filter-form">
            <label className="sr-only" htmlFor="catalog-search">
              Search products
            </label>
            <span aria-hidden="true" />
            <input
              id="catalog-search"
              name="q"
              defaultValue={q}
              placeholder="Search name, SKU or description"
            />
            <select name="status" defaultValue={status} aria-label="Product status">
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select name="sort" defaultValue={sort} aria-label="Sort products">
              <option value="updated-desc">Recently updated</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="price-asc">Price low–high</option>
              <option value="price-desc">Price high–low</option>
            </select>
            <button className="button button-primary" type="submit">
              Search
            </button>
            {(q || status || sort !== 'updated-desc') && (
              <Link className="clear-link" href="/products">
                Clear
              </Link>
            )}
          </form>
          <p>
            <strong>{resultCount.toLocaleString('en-GB')}</strong> matching products
          </p>
        </div>
        {!result.ok ? (
          <ApiNotice message={result.error} compact />
        ) : products.length === 0 ? (
          <div className="empty-state">
            <span>⌕</span>
            <h3>{q ? 'No matching products' : 'No products yet'}</h3>
            <p>
              {q
                ? `Try another search term instead of “${q}”.`
                : 'Add catalogue data through the API to see it here.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap product-table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Compliance</th>
                  <th>Storage</th>
                  <th>Rating</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const featuredImage =
                    product.imageUrl ??
                    product.images?.find((image) => /^https?:\/\//.test(image.url))?.url ??
                    null;
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell">
                          {featuredImage ? (
                            <span
                              className="product-thumbnail has-image"
                              style={{ backgroundImage: `url(${featuredImage})` }}
                              role="img"
                              aria-label={`${product.name} featured image`}
                            />
                          ) : (
                            <span className="product-thumbnail" aria-hidden="true">
                              {product.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div>
                            <Link href={`/products/${product.id}`}>
                              <strong>{product.name}</strong>
                            </Link>
                            <small>{product.description || product.unitPriceDisplay}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code>{product.sku}</code>
                      </td>
                      <td>
                        {product.isAlcohol ? (
                          <span className="compliance-badge">
                            18+ {product.abv ? `${product.abv}%` : ''}
                          </span>
                        ) : (
                          <span className="muted-text">Standard</span>
                        )}
                      </td>
                      <td>
                        <span className="soft-badge">{product.storageType.toLowerCase()}</span>
                      </td>
                      <td>
                        <span className="rating">★</span>{' '}
                        {(product.ratingAverageBps / 100).toFixed(1)}{' '}
                        <small>({product.ratingCount})</small>
                      </td>
                      <td>
                        <strong>
                          <Currency minor={product.priceMinor} currency={product.currency} />
                        </strong>
                        <small className="cell-subtext">{product.unitPriceDisplay}</small>
                      </td>
                      <td>
                        <span className="status-badge status-active">
                          <span />
                          {product.status.toLowerCase()}
                        </span>
                      </td>
                      <td>
                        <Link className="text-action" href={`/products/${product.id}`}>
                          Edit
                        </Link>
                        <form action={deleteProduct}>
                          <input type="hidden" name="id" value={product.id} />
                          <ConfirmSubmitButton
                            message={`Delete ${product.name}? Products used in previous orders will be retained internally for invoices and reports.`}
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {result.ok && (
          <TablePagination
            basePath="/products"
            page={result.data.page}
            pageCount={result.data.pageCount}
            total={result.data.total}
            params={{ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(sort !== 'updated-desc' ? { sort } : {}) }}
          />
        )}
      </article>
      <p className="page-note">
        Alcohol products remain excluded by the public API until a valid signed age-gate token is
        supplied.
      </p>
    </>
  );
}
