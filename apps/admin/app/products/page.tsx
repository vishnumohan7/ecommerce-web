/* eslint-disable local/no-jsx-literals -- Milestone 17 preview copy is English-only until the localisation catalogue lands. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { archiveProduct } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { ConfirmSubmitButton } from '../components/confirm-submit-button';
import { Currency } from '../components/currency';
import { fetchProducts, fetchSearch, type Product } from '../lib/api';

export const metadata: Metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string | string[]; success?: string; error?: string }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const searchResult = q ? await fetchSearch(q) : null;
  const productResult = q ? null : await fetchProducts();
  const result = searchResult ?? productResult;
  const products: Product[] = searchResult?.ok
    ? searchResult.data.items
    : productResult?.ok
      ? productResult.data
      : [];
  const resultCount = searchResult?.ok ? searchResult.data.resultCount : products.length;

  return (
    <>
      <section className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Products</h1>
          <p>Inspect live product, compliance and pricing data from the commerce API.</p>
        </div>
        <Link className="button button-primary" href="/products/new">
          + Add product
        </Link>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      <article className="panel">
        <div className="catalog-toolbar">
          <form action="/products" role="search">
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
            <button className="button button-primary" type="submit">
              Search
            </button>
            {q && (
              <Link className="clear-link" href="/products">
                Clear
              </Link>
            )}
          </form>
          <p>
            <strong>{resultCount.toLocaleString('en-GB')}</strong> {q ? 'matching' : 'loaded'}{' '}
            products
          </p>
        </div>
        {!result || !result.ok ? (
          <ApiNotice message={result?.error ?? 'The API request could not be prepared.'} compact />
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
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        <span>{product.name.slice(0, 1).toUpperCase()}</span>
                        <div>
                          <Link href={`/products/${product.id}`}><strong>{product.name}</strong></Link>
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
                      <Link className="text-action" href={`/products/${product.id}`}>Edit</Link>
                      <form action={archiveProduct}>
                        <input type="hidden" name="id" value={product.id} />
                        <ConfirmSubmitButton message={`Archive ${product.name}? It will disappear from the storefront.`}>
                          Archive
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
      <p className="page-note">
        Alcohol products remain excluded by the public API until a valid signed age-gate token is
        supplied.
      </p>
    </>
  );
}
