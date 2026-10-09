/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import Link from 'next/link';
import { toggleCustomer } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { Currency } from '../components/currency';
import { TablePagination } from '../components/table-pagination';
import { fetchCustomerPage } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const result = await fetchCustomerPage({ q, page: Math.max(1, Number(params.page) || 1) });
  return <>
    <section className="page-heading"><div><p className="eyebrow">CRM</p><h1>Customers</h1><p>Live customer accounts, order counts, spend and account status.</p></div><span className="count-pill">{result.ok ? result.data.total : 0} customers</span></section>
    <ActionMessage success={params.success} error={params.error} />
    <article className="panel">
      <form action="/customers" className="catalog-toolbar"><input name="q" defaultValue={q} placeholder="Search email or name" /><button className="button button-primary">Search</button>{q && <Link className="clear-link" href="/customers">Clear</Link>}</form>
      {!result.ok ? <ApiNotice message={result.error} /> : result.data.items.length === 0 ? <div className="empty-state"><h3>No customers found</h3><p>Try another name or email address.</p></div> : <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Contact</th><th>Orders</th><th>Spend</th><th>Status</th><th /></tr></thead><tbody>{result.data.items.map(customer => <tr key={customer.id}><td><Link href={`/customers/${customer.id}`}><strong>{customer.firstName} {customer.lastName}</strong></Link><small className="cell-subtext">Joined {new Date(customer.createdAt).toLocaleDateString('en-GB')}</small></td><td>{customer.email}<small className="cell-subtext">{customer.phone ?? 'No phone'}</small></td><td>{customer.orderCount}</td><td><Currency minor={customer.spendMinor} /></td><td><span className={`status-badge ${customer.active ? 'status-active' : 'status-down'}`}><span />{customer.active ? 'Active' : 'Disabled'}</span></td><td><Link className="text-action" href={`/customers/${customer.id}`}>View</Link><form action={toggleCustomer}><input type="hidden" name="id" value={customer.id} /><input type="hidden" name="active" value={String(customer.active)} /><button className="text-action" type="submit">{customer.active ? 'Disable' : 'Enable'}</button></form></td></tr>)}</tbody></table></div>}
      {result.ok && <TablePagination basePath="/customers" page={result.data.page} pageCount={result.data.pageCount} total={result.data.total} params={q ? { q } : {}} />}
    </article>
  </>;
}
