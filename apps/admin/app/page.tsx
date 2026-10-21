/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiNotice } from './components/api-notice';
import { Currency } from './components/currency';
import {
  fetchDashboard,
  fetchHealth,
  fetchInventoryPage,
  fetchOrders,
  fetchProducts,
} from './lib/api';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

function badgeClass(status: string) {
  if (['CAPTURED', 'DELIVERED', 'PASSED'].includes(status)) return 'status-active';
  if (['FAILED', 'CANCELLED', 'REFUSED'].includes(status)) return 'status-down';
  return 'status-warn';
}

export default async function DashboardPage() {
  const [health, products, dashboard, ordersResult, inventoryResult] = await Promise.all([
    fetchHealth('health'),
    fetchProducts(),
    fetchDashboard(),
    fetchOrders({ page: '1', pageSize: '6' }),
    fetchInventoryPage({ page: 1, pageSize: 12 }),
  ]);
  const productItems = products.ok ? products.data : [];
  const metrics = dashboard.ok ? dashboard.data : null;
  const recentOrders = ordersResult.ok ? ordersResult.data.items : [];
  const stockAlerts = inventoryResult.ok
    ? inventoryResult.data.items
        .filter((item) => item.stockAvailable <= item.lowStockThreshold)
        .slice(0, 6)
    : [];

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Operations centre</p>
          <h1>Good morning, Admin</h1>
          <p>Live orders, revenue, customers and operational exceptions from Supabase.</p>
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
            <strong>
              <Currency minor={metrics?.revenueMinor ?? 0} />
            </strong>
            <small>VAT-inclusive</small>
          </div>
        </article>
        <article className="metric-card accent-green">
          <div className="metric-icon">03</div>
          <div>
            <p>Average order</p>
            <strong>
              <Currency minor={metrics?.averageOrderValueMinor ?? 0} />
            </strong>
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
              {metrics?.orders ?? 0}
              <small> orders</small>
            </span>
          </div>
          <p className="readiness-copy">
            Orders are counted once while grocery and alcohol operations remain independently
            visible.
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
      <section className="dashboard-table-grid" aria-label="Operational exceptions">
        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Orders</p>
              <h2>Latest orders</h2>
            </div>
            <Link href="/orders">
              View all <span aria-hidden="true">→</span>
            </Link>
          </header>
          {!ordersResult.ok ? (
            <ApiNotice message={ordersResult.error} compact />
          ) : recentOrders.length > 0 ? (
            <div className="table-wrap">
              <table className="dashboard-operations-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Placed</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Fulfilment</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.displayOrderNumber}</strong>
                        <small className="table-secondary">{order.basketType.toLowerCase()}</small>
                      </td>
                      <td>{new Date(order.createdAt).toLocaleDateString('en-GB')}</td>
                      <td>
                        <strong>
                          <Currency minor={order.totalMinor} currency={order.currency} />
                        </strong>
                      </td>
                      <td>
                        <span className={`status-badge ${badgeClass(order.paymentStatus)}`}>
                          <span />
                          {order.paymentStatus.toLowerCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${badgeClass(order.fulfilmentStatus)}`}>
                          <span />
                          {order.fulfilmentStatus.replaceAll('_', ' ').toLowerCase()}
                        </span>
                      </td>
                      <td>
                        <Link className="table-action" href={`/orders/${order.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state dashboard-empty-state">
              <span>□</span>
              <h3>No orders yet</h3>
              <p>New orders will appear here as soon as they are placed.</p>
            </div>
          )}
        </article>

        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Inventory</p>
              <h2>Stock alerts</h2>
            </div>
            <Link href="/inventory">
              Manage stock <span aria-hidden="true">→</span>
            </Link>
          </header>
          {!inventoryResult.ok ? (
            <ApiNotice message={inventoryResult.error} compact />
          ) : stockAlerts.length > 0 ? (
            <div className="table-wrap">
              <table className="dashboard-operations-table stock-alert-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>On hand</th>
                    <th>Reserved</th>
                    <th>Available</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockAlerts.map((item) => {
                    const name = item.variant?.name ?? item.product?.name ?? 'Unknown product';
                    const sku = item.variant?.sku ?? item.product?.sku ?? item.id;
                    const outOfStock = item.stockAvailable <= 0;
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{name}</strong>
                          <small className="table-secondary">
                            Reorder at {item.lowStockThreshold}
                          </small>
                        </td>
                        <td>
                          <code>{sku}</code>
                        </td>
                        <td>{item.onHand}</td>
                        <td>{item.reserved}</td>
                        <td>
                          <strong>{item.stockAvailable}</strong>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${outOfStock ? 'status-down' : 'status-warn'}`}
                          >
                            <span />
                            {outOfStock ? 'out of stock' : 'low stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state dashboard-empty-state">
              <span>✓</span>
              <h3>Stock levels are healthy</h3>
              <p>All tracked items are above their low-stock thresholds.</p>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
