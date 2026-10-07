/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiNotice } from './components/api-notice';
import { Currency } from './components/currency';
import { fetchDashboard, fetchHealth, fetchProducts } from './lib/api';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [health, products, dashboard] = await Promise.all([
    fetchHealth('health'),
    fetchProducts(),
    fetchDashboard(),
  ]);
  const productItems = products.ok ? products.data : [];
  const metrics = dashboard.ok ? dashboard.data : null;

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Operations centre</p>
          <h1>Good morning, Admin</h1>
          <p>
            Live orders, revenue, customers and operational exceptions from Supabase.
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
      {!dashboard.ok && <ApiNotice message={dashboard.error} />}
      <section className="metric-grid" aria-label="Commerce summary">
        <article className="metric-card accent-orange">
          <div className="metric-icon">01</div>
          <div>
            <p>Orders</p>
            <strong>{metrics?.orders.toLocaleString('en-GB') ?? '—'}</strong>
            <small>Selected period</small>
          </div>
        </article>
        <article className="metric-card accent-blue">
          <div className="metric-icon">02</div>
          <div>
            <p>Revenue</p>
            <strong><Currency minor={metrics?.revenueMinor ?? 0} /></strong>
            <small>VAT-inclusive</small>
          </div>
        </article>
        <article className="metric-card accent-green">
          <div className="metric-icon">03</div>
          <div>
            <p>Average order</p>
            <strong><Currency minor={metrics?.averageOrderValueMinor ?? 0} /></strong>
            <small>{metrics?.unitsSold ?? 0} units sold</small>
          </div>
        </article>
        <article className="metric-card accent-purple">
          <div className="metric-icon">18+</div>
          <div>
            <p>Low stock</p>
            <strong>{metrics?.lowStock ?? '—'}</strong>
            <small>{metrics?.refunds ?? 0} refunds</small>
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
              <p className="eyebrow">Basket mix</p>
              <h2>Order composition</h2>
            </div>
          </header>
          <div
            className="readiness-ring"
            aria-label="Admin console is connected to live commerce queries"
          >
            <span>
              {metrics?.orders ?? 0}<small> orders</small>
            </span>
          </div>
          <p className="readiness-copy">
            Orders are counted once while grocery and alcohol operations remain independently visible.
          </p>
          <ul className="readiness-list">
            <li className="done">
              <span />
              Grocery: {metrics?.basketSplit.grocery ?? 0}
            </li>
            <li className="done">
              <span />
              Alcohol: {metrics?.basketSplit.alcohol ?? 0}
            </li>
            <li className="done">
              <span />
              Mixed: {metrics?.basketSplit.mixed ?? 0}
            </li>
            <li className="done">
              <span />
              New customers: {metrics?.newCustomers ?? 0}
            </li>
            <li className="done">
              <span />
              Coupon uses: {metrics?.couponUsage ?? 0}
            </li>
          </ul>
          <Link className="button button-muted button-full" href="/reports">
            Open reports
          </Link>
        </aside>
      </section>
    </>
  );
}
