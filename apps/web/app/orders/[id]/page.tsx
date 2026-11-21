'use client';
/* eslint-disable local/no-jsx-literals -- Storefront account copy is currently English-only. */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { browserApi, money } from '../../../lib/store-api';
import { AccountSidebar } from '../../components/account-sidebar';

interface Line {
  id: string;
  productName: string;
  quantity: number;
  lineTotalMinor: string;
  currency: string;
}

interface Order {
  id: string;
  displayOrderNumber: string;
  createdAt: string;
  currency: string;
  totalMinor: string;
  subtotalMinor: string;
  deliveryFeeMinor: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  deliveryAddress: Record<string, string>;
  sections: { grocery: Line[]; alcohol: Line[] };
}

interface TrackingStep {
  key: string;
  complete: boolean;
  at?: string;
}

interface Tracking {
  orderNumber: string;
  currentStatus: string;
  steps: TrackingStep[];
}

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [error, setError] = useState('');
  const [trackingError, setTrackingError] = useState('');

  useEffect(() => {
    void browserApi<Order>(`/api/v1/orders/${id}`)
      .then(setOrder)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unable to load order');
      });
    void browserApi<Tracking>(`/api/v1/orders/${id}/tracking`)
      .then(setTracking)
      .catch((reason: unknown) => {
        setTrackingError(reason instanceof Error ? reason.message : 'Tracking could not be loaded');
      });
  }, [id]);

  if (error) {
    return (
      <main className="account-page">
        <div className="error-state">
          {error} <Link href="/auth/login">Sign in</Link>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="account-page">
        <div className="skeleton">Loading order…</div>
      </main>
    );
  }

  const groups = [
    ['Groceries', order.sections.grocery],
    ['Alcohol · 18+', order.sections.alcohol],
  ] as const;

  return (
    <main className="account-page order-detail-account">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/orders">My orders</Link>
        <span>/</span>
        <strong>{order.displayOrderNumber}</strong>
      </div>
      <section className="account-welcome">
        <div className="section-heading order-detail-heading">
          <div>
            <p className="eyebrow">
              Placed {new Date(order.createdAt).toLocaleDateString('en-GB')}
            </p>
            <h1>{order.displayOrderNumber}</h1>
          </div>
          <div className="hero-actions">
            <a className="button secondary" href={`/api/store/api/v1/orders/${id}/invoice`}>
              Download invoice
            </a>
            <a className="button" href="#tracking">
              Track order
            </a>
          </div>
        </div>
      </section>

      <div className="account-dashboard">
        <AccountSidebar active="orders" />
        <section className="account-main">
          <div className="cart-layout order-detail-layout">
            <div>
              {groups.map(
                ([title, lines]) =>
                  lines.length > 0 && (
                    <section className="cart-group" key={title}>
                      <h2>{title}</h2>
                      {lines.map((line) => (
                        <div className="order-line" key={line.id}>
                          <span>
                            {line.quantity} × {line.productName}
                          </span>
                          <strong>{money(line.lineTotalMinor, line.currency)}</strong>
                        </div>
                      ))}
                    </section>
                  ),
              )}

              <section className="account-orders order-tracking-panel" id="tracking">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Live progress</p>
                    <h2>Order tracking</h2>
                  </div>
                  <span className="status">
                    {(tracking?.currentStatus ?? order.fulfilmentStatus).replaceAll('_', ' ')}
                  </span>
                </div>
                {trackingError ? (
                  <div className="error-state">{trackingError}</div>
                ) : tracking === null ? (
                  <div className="skeleton">Loading tracking…</div>
                ) : (
                  <ol className="timeline">
                    {tracking.steps.map((step, index) => (
                      <li
                        className={step.complete ? 'complete' : ''}
                        key={`${step.key}-${String(index)}`}
                      >
                        <span>{step.complete ? '✓' : index + 1}</span>
                        <div>
                          <strong>{step.key.replaceAll('_', ' ')}</strong>
                          {step.at && <small>{new Date(step.at).toLocaleString('en-GB')}</small>}
                          {step.key === 'DELIVERY_AGE_CHECK' && (
                            <p>
                              Challenge 25 applies. Valid photo ID may be requested at delivery.
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>

            <aside className="order-summary">
              <h2>Order status</h2>
              <p className="status">{order.fulfilmentStatus.replaceAll('_', ' ')}</p>
              <p>Payment: {order.paymentStatus.replaceAll('_', ' ')}</p>
              <dl>
                <div className="total">
                  <dt>Total</dt>
                  <dd>{money(order.totalMinor, order.currency)}</dd>
                </div>
              </dl>
              <h3>Delivery address</h3>
              <address>{Object.values(order.deliveryAddress).filter(Boolean).join(', ')}</address>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
