/* eslint-disable local/no-jsx-literals */
import { createPromotion, togglePromotion, updatePromotion } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { TablePagination } from '../components/table-pagination';
import { fetchAdminProducts, fetchPromotions } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [result, productsResult] = await Promise.all([fetchPromotions(page), fetchAdminProducts({ pageSize: 100, status: 'ACTIVE', sort: 'name-asc' })]);
  const products = productsResult.ok ? productsResult.data.items : [];
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Merchandising</p>
          <h1>Promotions</h1>
          <p>Create and schedule discounts with HFSS eligibility controls.</p>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      {!result.ok ? (
        <ApiNotice message={result.error} />
      ) : (
        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Campaign management</p>
              <h2>Promotions</h2>
            </div>
            <span className="count-pill">{result.data.total}</span>
          </header>
          <details className="create-disclosure" open={result.data.total === 0}>
            <summary>
              <span>
                <strong>Create promotion</strong>
                <small>Configure campaign dates, discount and eligible products</small>
              </span>
              <b aria-hidden="true">+</b>
            </summary>
            <form action={createPromotion} className="promotion-create">
              <label className="form-field">
                <span>Promotion name</span>
                <input name="name" placeholder="e.g. Autumn savings" required />
              </label>
              <label className="form-field">
                <span>Promotion type</span>
                <select name="type" defaultValue="PERCENTAGE">
                  <option value="PERCENTAGE">Percentage discount</option>
                  <option value="FIXED">Fixed discount</option>
                  <option value="MULTIBUY">Multibuy</option>
                  <option value="FREE_DELIVERY">Free delivery</option>
                </select>
              </label>
              <label className="form-field">
                <span>Starts</span>
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label className="form-field">
                <span>Ends</span>
                <input name="endsAt" type="datetime-local" required />
              </label>
              <label className="form-field">
                <span>Discount value</span>
                <input name="value" type="number" min="0" placeholder="Basis points or pence" />
                <small>Use 1000 for 10% or 500 for £5.00.</small>
              </label>
              <label className="form-field">
                <span>Minimum spend</span>
                <input
                  name="minimumSpendMinor"
                  type="number"
                  min="0"
                  placeholder="Pence (optional)"
                />
              </label>
              <label className="form-field">
                <span>Buy quantity</span>
                <input name="buyQuantity" type="number" min="2" defaultValue="3" />
                <small>Used for multibuy campaigns.</small>
              </label>
              <label className="form-field">
                <span>Pay quantity</span>
                <input name="payQuantity" type="number" min="1" defaultValue="2" />
                <small>Used for multibuy campaigns.</small>
              </label>
              <label className="form-field promotion-scope">
                <span>Eligible products</span>
                <select name="productIds" multiple size={Math.min(Math.max(products.length, 3), 6)}>
                  {products.map((product) => (
                    <option value={product.id} key={product.id}>
                      {product.name} — {product.sku}
                    </option>
                  ))}
                </select>
                <small>
                  Leave unselected to apply store-wide. Hold Command or Ctrl to select multiple
                  products.
                </small>
              </label>
              <div className="promotion-submit">
                <button className="button button-primary" type="submit">
                  Create promotion
                </button>
              </div>
            </form>
          </details>
          {result.data.items.length === 0 ? (
            <div className="empty-state promotion-empty">
              <span aria-hidden="true">%</span>
              <h3>No promotions yet</h3>
              <p>Create your first campaign using the form above.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Schedule</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>
                        <span className="soft-badge">{item.type.replaceAll('_', ' ')}</span>
                      </td>
                      <td>
                        {new Date(item.startsAt).toLocaleDateString('en-GB')} –{' '}
                        {new Date(item.endsAt).toLocaleDateString('en-GB')}
                      </td>
                      <td>{item.priority}</td>
                      <td>
                        <span
                          className={`status-badge ${item.active ? 'status-active' : 'status-down'}`}
                        >
                          <span />
                          {item.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <details className="row-editor">
                          <summary className="text-action">Edit</summary>
                          <form action={updatePromotion} className="inline-edit-form">
                            <input type="hidden" name="id" value={item.id} />
                            <label>Starts<input name="startsAt" type="datetime-local" defaultValue={new Date(item.startsAt).toISOString().slice(0, 16)} required /></label>
                            <label>Ends<input name="endsAt" type="datetime-local" defaultValue={new Date(item.endsAt).toISOString().slice(0, 16)} required /></label>
                            <label>Priority<input name="priority" type="number" defaultValue={item.priority} /></label>
                            <button className="button button-muted">Save</button>
                          </form>
                        </details>
                        <form action={togglePromotion}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="active" value={String(item.active)} />
                          <button className="text-action">
                            {item.active ? 'Disable' : 'Enable'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <TablePagination basePath="/promotions" page={result.data.page} pageCount={result.data.pageCount} total={result.data.total} />
        </article>
      )}
    </>
  );
}
