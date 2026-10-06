/* eslint-disable local/no-jsx-literals -- Milestone 17 admin preview is English-only. */
import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { initiateRefund, transitionFulfilment } from '../../actions';
import { ActionMessage } from '../../components/action-message';
import { ApiNotice } from '../../components/api-notice';
import { Currency } from '../../components/currency';
import type { FulfilmentGroup, OrderLine } from '../../lib/api';
import { fetchOrder } from '../../lib/api';

export const metadata: Metadata = { title: 'Order detail' };
export const dynamic = 'force-dynamic';

const nextStatuses: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PICKING', 'CANCELLED'],
  PICKING: ['PICKED', 'CANCELLED'],
  PICKED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'REFUSED'],
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}

function addressText(address: Record<string, unknown>) {
  return Object.values(address)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(', ');
}

function Lines({
  title,
  kind,
  lines,
}: Readonly<{ title: string; kind: 'grocery' | 'alcohol'; lines: OrderLine[] }>) {
  return (
    <article className={`panel order-section order-section-${kind}`}>
      <header className="panel-header">
        <div>
          <p className="eyebrow">{kind === 'alcohol' ? 'Age restricted' : 'General goods'}</p>
          <h2>{title}</h2>
        </div>
        <span className="count-pill">
          {lines.reduce((sum, line) => sum + line.quantity, 0)} items
        </span>
      </header>
      {lines.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>VAT</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <strong>{line.productName}</strong>
                    <small className="cell-subtext">
                      {line.unitPriceDisplay}
                      {line.abv ? ` · ${line.abv}% ABV` : ''}
                    </small>
                  </td>
                  <td>
                    <code>{line.sku}</code>
                  </td>
                  <td>{line.quantity}</td>
                  <td>{(line.vatRateBps / 100).toFixed(0)}%</td>
                  <td>
                    <strong>
                      <Currency minor={line.lineTotalMinor} currency={line.currency} />
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state compact-empty">
          <p>No {kind} lines in this order.</p>
        </div>
      )}
    </article>
  );
}

function Fulfilment({ orderId, group }: Readonly<{ orderId: string; group: FulfilmentGroup }>) {
  const available = nextStatuses[group.status] ?? [];
  return (
    <div className="fulfilment-row">
      <div>
        <span className={group.category === 'ALCOHOL' ? 'compliance-badge' : 'soft-badge'}>
          {group.category}
        </span>
        <strong>{group.status.replaceAll('_', ' ')}</strong>
      </div>
      {available.length > 0 ? (
        <form action={transitionFulfilment} className="status-form">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="groupId" value={group.id} />
          <select name="status" aria-label={`Next ${group.category.toLowerCase()} status`}>
            {available.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <button className="button button-muted" type="submit">
            Update
          </button>
        </form>
      ) : (
        <span className="muted-text">Final status</span>
      )}
    </div>
  );
}

export default async function OrderDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const [query, result] = await Promise.all([searchParams, fetchOrder(id)]);
  if (!result.ok) {
    return (
      <>
        <section className="page-heading">
          <div>
            <p className="eyebrow">Commerce operations</p>
            <h1>Order unavailable</h1>
            <p>The requested order could not be loaded.</p>
          </div>
        </section>
        <ApiNotice message={result.error} />
        <Link className="button button-muted" href="/orders">
          Back to orders
        </Link>
      </>
    );
  }
  const order = result.data;
  return (
    <>
      <section className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Order detail</p>
          <h1>{order.displayOrderNumber}</h1>
          <p>
            Placed {new Date(order.createdAt).toLocaleString('en-GB')} ·{' '}
            {order.basketType.toLowerCase()} basket
          </p>
        </div>
        <div className="heading-actions">
          <Link className="button button-muted" href="/orders">
            Back
          </Link>
          {order.invoice && (
            <Link className="button button-primary" href={`/orders/${id}/invoice`}>
              Download {order.invoice.displayInvoiceNumber}
            </Link>
          )}
        </div>
      </section>
      <ActionMessage success={query.success} error={query.error} />
      <section className="order-summary-grid">
        <article>
          <span>Total</span>
          <strong>
            <Currency minor={order.totalMinor} currency={order.currency} />
          </strong>
        </article>
        <article>
          <span>Payment</span>
          <strong>{order.paymentStatus.replaceAll('_', ' ')}</strong>
        </article>
        <article>
          <span>Fulfilment</span>
          <strong>{order.fulfilmentStatus.replaceAll('_', ' ')}</strong>
        </article>
        <article>
          <span>Age check</span>
          <strong>{order.deliveryAgeCheckStatus.replaceAll('_', ' ')}</strong>
        </article>
      </section>
      <section className="order-detail-grid">
        <div>
          <Lines title="Grocery items" kind="grocery" lines={order.sections.grocery} />
          <Lines title="Alcohol items (18+)" kind="alcohol" lines={order.sections.alcohol} />
        </div>
        <aside>
          <article className="panel order-side-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Workflow</p>
                <h2>Fulfilment groups</h2>
              </div>
            </header>
            <div className="fulfilment-list">
              {order.fulfilmentGroups.map((group) => (
                <Fulfilment key={group.id} orderId={order.id} group={group} />
              ))}
            </div>
          </article>
          <article className="panel order-side-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Destination</p>
                <h2>Delivery address</h2>
              </div>
            </header>
            <p className="address-copy">
              {addressText(order.deliveryAddress) || 'No delivery address available.'}
            </p>
          </article>
          <article className="panel order-side-panel totals-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Payment</p>
                <h2>Order totals</h2>
              </div>
            </header>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>
                  <Currency minor={order.subtotalMinor} currency={order.currency} />
                </dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>
                  −<Currency minor={order.discountMinor} currency={order.currency} />
                </dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>
                  <Currency minor={order.deliveryFeeMinor} currency={order.currency} />
                </dd>
              </div>
              <div>
                <dt>VAT included</dt>
                <dd>
                  <Currency minor={order.taxMinor} currency={order.currency} />
                </dd>
              </div>
              <div className="total-line">
                <dt>Total</dt>
                <dd>
                  <Currency minor={order.totalMinor} currency={order.currency} />
                </dd>
              </div>
            </dl>
          </article>
        </aside>
      </section>
      <article className="panel refund-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Payment adjustment</p>
            <h2>Initiate a refund</h2>
          </div>
          <span className="status-badge status-warn">
            <span />
            {order.refundStatus.replaceAll('_', ' ')}
          </span>
        </header>
        <form action={initiateRefund} className="refund-form">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="idempotencyKey" value={`admin-${randomUUID()}`} />
          <div className="refund-lines">
            {[...order.sections.grocery, ...order.sections.alcohol].map((line) => (
              <label key={line.id}>
                <span>
                  <strong>{line.productName}</strong>
                  <small>
                    {line.sku} · ordered {line.quantity}
                  </small>
                </span>
                <input
                  aria-label={`Refund quantity for ${line.productName}`}
                  name={`quantity:${line.id}`}
                  type="number"
                  min="0"
                  max={line.quantity}
                  defaultValue="0"
                />
              </label>
            ))}
          </div>
          <div className="refund-controls">
            <label>
              Refund method
              <select name="method" defaultValue="CARD">
                <option value="CARD">Original card</option>
                <option value="STORE_CREDIT">Store credit</option>
              </select>
            </label>
            <label className="refund-reason">
              Reason
              <input name="reason" required maxLength={300} placeholder="Reason for refund" />
            </label>
            <button className="button button-primary" type="submit">
              Initiate refund
            </button>
          </div>
          <p className="page-note">
            Enter only the quantities to refund. The API validates prior refunds, captured payment
            limits and approved return quantities.
          </p>
        </form>
      </article>
    </>
  );
}
