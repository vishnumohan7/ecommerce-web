'use client';
/* eslint-disable local/no-jsx-literals */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { browserApi, money } from '../../lib/store-api';

interface Order {
  id: string;
  displayOrderNumber: string;
  createdAt: string;
  label: string;
  totalMinor: string;
  currency: string;
  paymentStatus: string;
  fulfilmentStatus: string;
}

interface Confirmation {
  orderId: string;
  paymentId: string;
  method: 'card' | 'cod';
}

function readConfirmation(): Confirmation | null {
  const query = new URLSearchParams(window.location.search);
  const orderId = query.get('confirmed');
  if (!orderId) return null;

  return {
    orderId,
    paymentId: query.get('payment') ?? '',
    method: query.get('method') === 'card' ? 'card' : 'cod',
  };
}

function OrderConfirmation({ confirmation }: Readonly<{ confirmation: Confirmation }>) {
  const cardPayment = confirmation.method === 'card';

  return (
    <section className="dashboard-confirmation" aria-live="polite">
      <div className="dashboard-confirmation-heading">
        <span className="dashboard-confirmation-icon" aria-hidden="true">
          ✓
        </span>
        <div>
          <p className="eyebrow">Order confirmed</p>
          <h2>Thank you. Your order has been placed.</h2>
          <p>Your order, invoice and fulfilment record are ready in your account.</p>
        </div>
        <div className="confirmation-actions">
          <Link className="button secondary" href={`/orders/${confirmation.orderId}`}>
            View order
          </Link>
          <a
            className="button secondary"
            href={`/api/store/api/v1/orders/${confirmation.orderId}/invoice`}
          >
            Download invoice
          </a>
          <Link className="button gold" href="/">
            Continue shopping
          </Link>
        </div>
      </div>
      <div className="dashboard-confirmation-grid">
        <article>
          <p className="eyebrow">Payment</p>
          <h3>{cardPayment ? 'Paid securely by card' : 'Cash on delivery'}</h3>
          {confirmation.paymentId && (
            <p className="payment-reference">
              Reference <code>{confirmation.paymentId}</code>
            </p>
          )}
          <p>
            {cardPayment
              ? 'Your card payment has been confirmed.'
              : 'Payment remains pending until collection at delivery.'}
          </p>
        </article>
        <article>
          <p className="eyebrow">Fulfilment</p>
          <h3>Order received</h3>
          <ol className="confirmation-timeline">
            <li className="complete">Order placed</li>
            <li>Picking and packing</li>
            <li>Dispatched</li>
            <li>Delivered</li>
          </ol>
        </article>
        <article>
          <p className="eyebrow">Delivery</p>
          <h3>Delivery checks</h3>
          <p>
            If alcohol is included, Challenge 25 applies and valid photo ID may be requested at
            delivery.
          </p>
        </article>
      </div>
    </section>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setConfirmation(readConfirmation());
    void browserApi<Order[]>('/api/v1/orders')
      .then(setOrders)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Orders could not be loaded');
      });
  }, []);

  if (error) {
    return (
      <main className="section">
        <div className="empty-state">
          <h1>Sign in to view orders</h1>
          <p>{error}</p>
          <Link className="button" href="/auth/login">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const paid = orders?.reduce((total, order) => total + Number(order.totalMinor), 0) ?? 0;
  const active =
    orders?.filter(
      (order) => !['DELIVERED', 'CANCELLED', 'REFUSED'].includes(order.fulfilmentStatus),
    ).length ?? 0;

  return (
    <main className="account-page">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>Dashboard &amp; orders</strong>
      </div>
      <section className="account-welcome">
        <p className="eyebrow">My account</p>
        <h1>Namaskaram</h1>
        <p>Review your live orders, invoices and fulfilment progress.</p>
      </section>
      <div className="account-dashboard">
        <aside className="account-sidebar">
          <strong>My account</strong>
          <Link className="active" href="/orders">
            My orders &amp; tracking
          </Link>
          <Link href="/wishlist">Saved favourites</Link>
          <Link href="/addresses">Saved addresses</Link>
          <Link href="/profile">Account settings</Link>
          <Link href="/auth/login">Sign in / switch account</Link>
        </aside>
        <section className="account-main">
          {confirmation && <OrderConfirmation confirmation={confirmation} />}
          <div className="account-stats">
            <article>
              <small>Total orders</small>
              <strong>{orders?.length ?? '—'}</strong>
            </article>
            <article>
              <small>Active orders</small>
              <strong>{active}</strong>
            </article>
            <article>
              <small>Order value</small>
              <strong>{money(paid, orders?.[0]?.currency ?? 'GBP')}</strong>
            </article>
          </div>
          {orders === null ? (
            <div className="skeleton">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <h2>No orders yet</h2>
              <Link className="button" href="/">
                Start shopping
              </Link>
            </div>
          ) : (
            <section className="account-orders">
              <div className="section-heading">
                <h2>Order history</h2>
                <span>{orders.length} orders</span>
              </div>
              <div className="order-list">
                {orders.map((order) => (
                  <article key={order.id}>
                    <div>
                      <p>{new Date(order.createdAt).toLocaleDateString('en-GB')}</p>
                      <h2>{order.displayOrderNumber}</h2>
                      <span>{order.label}</span>
                    </div>
                    <div>
                      <span className="status">{order.fulfilmentStatus.replaceAll('_', ' ')}</span>
                      <strong>{money(order.totalMinor, order.currency)}</strong>
                      <Link className="button compact" href={`/orders/${order.id}`}>
                        View order
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
