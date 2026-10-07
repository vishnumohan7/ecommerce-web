/* eslint-disable local/no-jsx-literals */
import Link from 'next/link';
import { toggleCustomer } from '../../actions';
import { ApiNotice } from '../../components/api-notice';
import { Currency } from '../../components/currency';
import { fetchCustomer } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await fetchCustomer(id);
  if (!result.ok) return <ApiNotice message={result.error} />;
  const customer = result.data;
  const spend = customer.orders.reduce((sum, order) => sum + BigInt(order.totalMinor), 0n).toString();
  return <>
    <section className="page-heading compact-heading"><div><p className="eyebrow">Customer profile</p><h1>{customer.firstName} {customer.lastName}</h1><p>{customer.email} · joined {new Date(customer.createdAt).toLocaleDateString('en-GB')}</p></div><div className="heading-actions"><Link className="button button-muted" href="/customers">Back</Link><form action={toggleCustomer}><input type="hidden" name="id" value={customer.id}/><input type="hidden" name="active" value={String(customer.active)}/><button className={`button ${customer.active?'button-danger':'button-primary'}`}>{customer.active?'Disable account':'Enable account'}</button></form></div></section>
    <section className="customer-stat-grid"><article><span>Orders</span><strong>{customer.orders.length}</strong></article><article><span>Lifetime spend</span><strong><Currency minor={spend}/></strong></article><article><span>Reviews</span><strong>{customer.reviews.length}</strong></article><article><span>Status</span><strong>{customer.active?'Active':'Disabled'}</strong></article></section>
    <div className="customer-detail-grid">
      <article className="panel"><div className="panel-header"><div><p className="eyebrow">History</p><h2>Orders</h2></div></div>{customer.orders.length?<div className="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Payment</th><th>Fulfilment</th><th>Total</th></tr></thead><tbody>{customer.orders.map(order=><tr key={order.id}><td><Link href={`/orders/${order.id}`}><strong>{`DEN-${order.orderNumberYear}-${String(order.orderNumber).padStart(6,'0')}`}</strong></Link></td><td>{new Date(order.createdAt).toLocaleDateString('en-GB')}</td><td>{order.paymentStatus.replaceAll('_',' ')}</td><td>{order.fulfilmentStatus.replaceAll('_',' ')}</td><td><Currency minor={order.totalMinor}/></td></tr>)}</tbody></table></div>:<div className="empty-state compact-empty"><p>No orders yet.</p></div>}</article>
      <aside><article className="panel"><div className="panel-header"><div><p className="eyebrow">Contact</p><h2>Account details</h2></div></div><dl className="detail-list"><div><dt>Email</dt><dd>{customer.email}</dd></div><div><dt>Phone</dt><dd>{customer.phone??'Not provided'}</dd></div></dl></article><article className="panel section-gap"><div className="panel-header"><div><p className="eyebrow">Delivery</p><h2>Saved addresses</h2></div></div>{customer.addresses.length?<div className="address-list">{customer.addresses.map(address=><address key={address.id}><strong>{address.label}{address.isDefault?' · Default':''}</strong><span>{[address.line1,address.line2,address.city,address.postcode,address.country].filter(Boolean).join(', ')}</span></address>)}</div>:<div className="empty-state compact-empty"><p>No saved addresses.</p></div>}</article></aside>
    </div>
  </>;
}
