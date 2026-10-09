/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import Link from 'next/link';
import { adjustInventory } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { TablePagination } from '../components/table-pagination';
import { fetchInventoryPage } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const page = Math.max(1, Number(params.page) || 1);
  const result = await fetchInventoryPage({ page, q });
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Stock control</p>
          <h1>Inventory</h1>
          <p>On-hand, reserved and available stock with audited adjustments.</p>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      <article className="panel">
        <div className="catalog-toolbar inventory-toolbar">
          <form action="/inventory" role="search">
            <label className="sr-only" htmlFor="inventory-search">Search inventory</label>
            <input id="inventory-search" name="q" defaultValue={q} placeholder="Search product name or SKU" />
            <button className="button button-primary">Search</button>
            {q && <Link className="clear-link" href="/inventory">Clear</Link>}
          </form>
          {result.ok && <p><strong>{result.data.total.toLocaleString('en-GB')}</strong> stock records</p>}
        </div>
        {!result.ok ? (
          <ApiNotice message={result.error} />
        ) : result.data.items.length === 0 ? (
          <div className="empty-state"><h3>No stock records found</h3><p>Try a different product name or SKU.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Adjustment</th></tr></thead>
              <tbody>
                {result.data.items.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.product?.name ?? row.productId}</strong><small className="cell-subtext">{row.product?.sku ?? row.id}</small></td>
                    <td>{row.onHand}</td>
                    <td>{row.reserved}</td>
                    <td><span className={row.stockAvailable <= row.lowStockThreshold ? 'compliance-badge' : 'soft-badge'}>{row.stockAvailable}</span></td>
                    <td>
                      <form action={adjustInventory} className="row-form">
                        <input type="hidden" name="id" value={row.id} />
                        <input name="quantity" type="number" placeholder="± qty" required />
                        <select name="reason"><option value="ADJUSTMENT">Adjustment</option><option value="PURCHASE">Stock receipt</option><option value="WASTAGE">Wastage</option><option value="RETURN">Return</option></select>
                        <input name="reference" placeholder="Reference" />
                        <button className="button button-muted">Apply</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result.ok && <TablePagination basePath="/inventory" page={result.data.page} pageCount={result.data.pageCount} total={result.data.total} params={q ? { q } : {}} />}
      </article>
    </>
  );
}
