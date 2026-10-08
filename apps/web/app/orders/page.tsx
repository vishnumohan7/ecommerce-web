'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { browserApi, money } from '../../lib/store-api';

interface Order { id: string; displayOrderNumber: string; createdAt: string; label: string; totalMinor: string; currency: string; paymentStatus: string; fulfilmentStatus: string }

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void browserApi<Order[]>('/api/v1/orders').then(setOrders).catch((reason: Error) => setError(reason.message)); }, []);
  if (error) return <main className="section"><div className="empty-state"><h1>Sign in to view orders</h1><p>{error}</p><Link className="button" href="/auth/login">Sign in</Link></div></main>;
  const paid = orders?.reduce((total, order) => total + Number(order.totalMinor), 0) ?? 0;
  const active = orders?.filter((order) => !['DELIVERED', 'CANCELLED', 'REFUSED'].includes(order.fulfilmentStatus)).length ?? 0;
  return <main className="account-page"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><strong>Dashboard &amp; orders</strong></div><section className="account-welcome"><p className="eyebrow">My account</p><h1>Namaskaram</h1><p>Review your live orders, invoices and fulfilment progress.</p></section><div className="account-dashboard"><aside className="account-sidebar"><strong>My account</strong><Link className="active" href="/orders">My orders &amp; tracking</Link><Link href="/wishlist">Saved favourites</Link><Link href="/addresses">Saved addresses</Link><Link href="/profile">Account settings</Link><Link href="/auth/login">Sign in / switch account</Link></aside><section className="account-main"><div className="account-stats"><article><small>Total orders</small><strong>{orders?.length ?? '—'}</strong></article><article><small>Active orders</small><strong>{active}</strong></article><article><small>Order value</small><strong>{money(paid, orders?.[0]?.currency ?? 'GBP')}</strong></article></div>{orders === null ? <div className="skeleton">Loading orders…</div> : orders.length === 0 ? <div className="empty-state"><h2>No orders yet</h2><Link className="button" href="/">Start shopping</Link></div> : <section className="account-orders"><div className="section-heading"><h2>Order history</h2><span>{orders.length} orders</span></div><div className="order-list">{orders.map((order) => <article key={order.id}><div><p>{new Date(order.createdAt).toLocaleDateString('en-GB')}</p><h2>{order.displayOrderNumber}</h2><span>{order.label}</span></div><div><span className="status">{order.fulfilmentStatus.replaceAll('_', ' ')}</span><strong>{money(order.totalMinor, order.currency)}</strong><Link className="button compact" href={`/orders/${order.id}`}>View order</Link></div></article>)}</div></section>}</section></div></main>;
}
