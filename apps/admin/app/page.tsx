/* eslint-disable local/no-jsx-literals -- Milestone 17 preview copy is English-only until the localisation catalogue lands. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiNotice } from './components/api-notice';
import { Currency } from './components/currency';
import { fetchHealth, fetchProducts, fetchSearch } from './lib/api';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [health, products, search] = await Promise.all([
    fetchHealth('health'),
    fetchProducts(),
    fetchSearch(''),
  ]);
  const productItems = products.ok ? products.data : [];
  const searchData = search.ok ? search.data : null;
  const activeProducts = searchData?.resultCount ?? productItems.length;
  const alcoholCount = productItems.filter((product) => product.isAlcohol).length;
  const averagePrice = productItems.length
    ? productItems.reduce((total, product) => total + Number(product.priceMinor), 0) /
      productItems.length
    : 0;

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Operations centre</p>
          <h1>Good morning, Admin</h1>
          <p>
            Live catalogue visibility with a clear view of what is connected and what is still being
            built.
          </p>
        </div>
        <div className="heading-actions">
          <span className={`api-state ${health.ok ? 'is-online' : 'is-offline'}`}>
            <span /> API {health.ok ? 'online' : 'unreachable'}
          </span>
          <Link className="button button-primary" href="/products">
            View catalogue
          </Link>
        </div>
      </section>
      {!health.ok && <ApiNotice message={health.error} />}
      <section className="metric-grid" aria-label="Catalogue summary">
        <article className="metric-card accent-orange">
          <div className="metric-icon">01</div>
          <div>
            <p>Active products</p>
            <strong>{activeProducts.toLocaleString('en-GB')}</strong>
            <small>From catalogue search</small>
          </div>
        </article>
        <article className="metric-card accent-blue">
          <div className="metric-icon">02</div>
          <div>
            <p>Previewed items</p>
            <strong>{productItems.length}</strong>
            <small>Current API page</small>
          </div>
        </article>
        <article className="metric-card accent-green">
          <div className="metric-icon">03</div>
          <div>
            <p>Average unit price</p>
            <strong>
              <Currency minor={averagePrice} />
            </strong>
            <small>Across previewed items</small>
          </div>
        </article>
        <article className="metric-card accent-purple">
          <div className="metric-icon">18+</div>
          <div>
            <p>Alcohol products</p>
            <strong>{alcoholCount}</strong>
            <small>Hidden until age gate</small>
          </div>
        </article>
      </section>
      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Catalogue</p>
              <h2>Recently available products</h2>
            </div>
            <Link href="/products">
              See all <span aria-hidden="true">→</span>
            </Link>
          </header>
          {products.ok && productItems.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Storage</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {productItems.slice(0, 6).map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell">
                          <span>{product.name.slice(0, 1).toUpperCase()}</span>
                          <div>
                            <strong>{product.name}</strong>
                            <small>{product.unitPriceDisplay}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code>{product.sku}</code>
                      </td>
                      <td>
                        <span className="soft-badge">{product.storageType.toLowerCase()}</span>
                      </td>
                      <td>
                        <strong>
                          <Currency minor={product.priceMinor} currency={product.currency} />
                        </strong>
                      </td>
                      <td>
                        <span className="status-badge status-active">
                          <span />
                          {product.status.toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : products.ok ? (
            <div className="empty-state">
              <span>□</span>
              <h3>No products yet</h3>
              <p>The catalogue is connected, but there are no active items to show.</p>
            </div>
          ) : (
            <ApiNotice message={products.error} compact />
          )}
        </article>
        <aside className="panel progress-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Build visibility</p>
              <h2>Admin readiness</h2>
            </div>
          </header>
          <div
            className="readiness-ring"
            aria-label="Admin preview foundation is 35 percent complete"
          >
            <span>
              35<small>%</small>
            </span>
          </div>
          <p className="readiness-copy">
            The visual foundation and public read paths are live. Secure management workflows follow
            their backend milestones.
          </p>
          <ul className="readiness-list">
            <li className="done">
              <span />
              Dashboard shell
            </li>
            <li className="done">
              <span />
              Product catalogue read view
            </li>
            <li className="done">
              <span />
              API health visibility
            </li>
            <li>
              <span />
              Admin authentication and RBAC
            </li>
            <li>
              <span />
              Orders, customers and refunds
            </li>
          </ul>
          <Link className="button button-muted button-full" href="/feature-status">
            Open feature matrix
          </Link>
        </aside>
      </section>
    </>
  );
}
