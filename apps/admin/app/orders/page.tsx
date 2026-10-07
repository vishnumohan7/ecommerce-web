/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiNotice } from '../components/api-notice';
import { Currency } from '../components/currency';
import { fetchOrders } from '../lib/api';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    basketType?: string;
    paymentStatus?: string;
    fulfilmentStatus?: string;
  }>;
}

function badgeClass(status: string) {
  if (['CAPTURED', 'DELIVERED', 'PASSED'].includes(status)) return 'status-active';
  if (['FAILED', 'CANCELLED', 'REFUSED'].includes(status)) return 'status-down';
  return 'status-warn';
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const result = await fetchOrders(filters);
  const orders = result.ok ? result.data : [];

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Commerce operations</p>
          <h1>Orders</h1>
          <p>Review grocery and alcohol baskets, payment state and fulfilment progress.</p>
        </div>
        <span className="count-pill">{orders.length} orders</span>
      </section>
      {!result.ok && <ApiNotice message={result.error} />}
      <article className="panel">
        <form className="order-filters" action="/orders">
          <input
            name="search"
            defaultValue={filters.search}
            inputMode="numeric"
            placeholder="Order number"
            aria-label="Search by order number"
          />
          <select
            name="basketType"
            defaultValue={filters.basketType ?? ''}
            aria-label="Basket type"
          >
            <option value="">All baskets</option>
            <option value="GROCERY">Grocery</option>
            <option value="ALCOHOL">Alcohol</option>
            <option value="MIXED">Mixed</option>
          </select>
          <select
            name="paymentStatus"
            defaultValue={filters.paymentStatus ?? ''}
            aria-label="Payment status"
          >
            <option value="">All payments</option>
            <option value="PENDING">Pending</option>
            <option value="AUTHORISED">Authorised</option>
            <option value="CAPTURED">Captured</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <select
            name="fulfilmentStatus"
            defaultValue={filters.fulfilmentStatus ?? ''}
            aria-label="Fulfilment status"
          >
            <option value="">All fulfilment</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PICKING">Picking</option>
            <option value="PICKED">Picked</option>
            <option value="OUT_FOR_DELIVERY">Out for delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="REFUSED">Refused</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button className="button button-primary" type="submit">
            Apply filters
          </button>
          <Link className="clear-link" href="/orders">
            Clear
          </Link>
        </form>
        {result.ok && orders.length > 0 ? (
          <div className="table-wrap">
            <table className="order-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Basket</th>
                  <th>Placed</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Fulfilment</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.displayOrderNumber}</strong>
                      <small className="cell-subtext">{order.id}</small>
                    </td>
                    <td>
                      <span
                        className={
                          order.basketType === 'GROCERY' ? 'soft-badge' : 'compliance-badge'
                        }
                      >
                        {order.basketType.toLowerCase()}
                      </span>
                      <small className="cell-subtext">{order.label}</small>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleString('en-GB')}</td>
                    <td>
                      <strong>
                        <Currency minor={order.totalMinor} currency={order.currency} />
                      </strong>
                    </td>
                    <td>
                      <span className={`status-badge ${badgeClass(order.paymentStatus)}`}>
                        <span />
                        {order.paymentStatus.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${badgeClass(order.fulfilmentStatus)}`}>
                        <span />
                        {order.fulfilmentStatus.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <Link className="text-action" href={`/orders/${order.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : result.ok ? (
          <div className="empty-state">
            <span>□</span>
            <h3>No matching orders</h3>
            <p>Orders will appear here after a successful checkout.</p>
          </div>
        ) : null}
      </article>
    </>
  );
}
