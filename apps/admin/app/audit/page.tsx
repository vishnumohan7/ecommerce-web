/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import Link from 'next/link';
import { ApiNotice } from '../components/api-notice';
import { TablePagination } from '../components/table-pagination';
import { fetchAuditLog } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; entity?: string; action?: string }> }) {
  const params = await searchParams;
  const result = await fetchAuditLog({ page: Math.max(1, Number(params.page) || 1), ...(params.entity ? { entity: params.entity } : {}), ...(params.action ? { action: params.action } : {}) });
  return <><section className="page-heading"><div><p className="eyebrow">Traceability</p><h1>Audit log</h1><p>Immutable operational activity from the live store.</p></div><span className="count-pill">{result.ok ? result.data.total : 0} events</span></section><article className="panel"><form action="/audit" className="order-filters"><input name="action" defaultValue={params.action} placeholder="Action" /><input name="entity" defaultValue={params.entity} placeholder="Entity" /><button className="button button-primary">Filter</button>{(params.action || params.entity) && <Link className="clear-link" href="/audit">Clear</Link>}</form>{!result.ok ? <ApiNotice message={result.error} /> : <><div className="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th><th>Request</th></tr></thead><tbody>{result.data.items.map(x => <tr key={x.id}><td>{new Date(x.createdAt).toLocaleString('en-GB')}</td><td><strong>{x.action}</strong></td><td>{x.entity}<small className="cell-subtext">{x.entityId}</small></td><td>{x.actorType}<small className="cell-subtext">{x.actorId ?? 'system'}</small></td><td><code>{x.requestId}</code></td></tr>)}</tbody></table></div><TablePagination basePath="/audit" page={result.data.page} pageCount={result.data.pageCount} total={result.data.total} params={{ ...(params.entity ? { entity: params.entity } : {}), ...(params.action ? { action: params.action } : {}) }} /></>}</article></>;
}
