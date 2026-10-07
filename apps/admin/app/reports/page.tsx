/* eslint-disable local/no-jsx-literals */
import type { ReactNode } from 'react';
import { ApiNotice } from '../components/api-notice';
import { Currency } from '../components/currency';
import {
  fetchCategories,
  fetchCoupons,
  fetchCouponReport,
  fetchCategoryReport,
  fetchCustomers,
  fetchCustomerReport,
  fetchProducts,
  fetchProductReport,
  fetchSalesReport,
  type ReportFilters,
} from '../lib/api';

export const dynamic = 'force-dynamic';

function Metric({ label, value, tone }: { label: string; value: ReactNode; tone: string }) {
  return (
    <article className={`report-metric ${tone}`}>
      <span className="report-metric-mark" aria-hidden="true" />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportFilters> }) {
  const params = await searchParams;
  const [sales, customers, products, coupons, categories, productOptions, categoryOptions, customerOptions, couponOptions] = await Promise.all([
    fetchSalesReport(params),
    fetchCustomerReport(params),
    fetchProductReport(params),
    fetchCouponReport(params),
    fetchCategoryReport(params),
    fetchProducts(),
    fetchCategories(),
    fetchCustomers(),
    fetchCoupons(),
  ]);
  const activeFilters = Object.values(params).filter(Boolean).length;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Business intelligence</p>
          <h1>Reports</h1>
          <p>Analyse sales across dates, products, categories, customers and order states.</p>
        </div>
      </section>
      <form className="report-filter panel" action="/reports">
        <div className="report-filter-title">
          <div><strong>Report filters</strong><small>{activeFilters ? `${activeFilters} active` : 'All completed orders'}</small></div>
          {activeFilters > 0 && <a className="text-action" href="/reports">Reset all</a>}
        </div>
        <div className="report-filter-grid">
          <label>From<input name="from" type="date" defaultValue={params.from}/></label>
          <label>To<input name="to" type="date" defaultValue={params.to}/></label>
          <label>Product<select name="productId" defaultValue={params.productId ?? ''}><option value="">All products</option>{productOptions.ok && productOptions.data.map(item=><option key={item.id} value={item.id}>{item.name} — {item.sku}</option>)}</select></label>
          <label>Category<select name="categoryId" defaultValue={params.categoryId ?? ''}><option value="">All categories</option>{categoryOptions.ok && categoryOptions.data.items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Customer<select name="customerId" defaultValue={params.customerId ?? ''}><option value="">All customers</option>{customerOptions.ok && customerOptions.data.map(item=><option key={item.id} value={item.id}>{item.firstName} {item.lastName} — {item.email}</option>)}</select></label>
          <label>Coupon<select name="couponId" defaultValue={params.couponId ?? ''}><option value="">All coupons</option>{couponOptions.ok && couponOptions.data.map(item=><option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label>Basket<select name="basketType" defaultValue={params.basketType ?? ''}><option value="">All baskets</option><option value="GROCERY">Grocery</option><option value="ALCOHOL">Alcohol</option><option value="MIXED">Mixed</option></select></label>
          <label>Payment<select name="paymentStatus" defaultValue={params.paymentStatus ?? ''}><option value="">All payment states</option><option value="CAPTURED">Captured</option><option value="AUTHORISED">Authorised</option><option value="PENDING">Pending</option><option value="PARTIALLY_REFUNDED">Partially refunded</option><option value="REFUNDED">Refunded</option><option value="FAILED">Failed</option><option value="CANCELLED">Cancelled</option></select></label>
          <label>Fulfilment<select name="fulfilmentStatus" defaultValue={params.fulfilmentStatus ?? ''}><option value="">All fulfilment states</option>{['PENDING','CONFIRMED','PICKING','PICKED','OUT_FOR_DELIVERY','DELIVERED','REFUSED','CANCELLED'].map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></label>
        </div>
        <div className="report-filter-actions"><button className="button button-primary" type="submit">Generate report</button><a className="button button-muted" href="/reports">Clear filters</a></div>
      </form>
      {!sales.ok ? (
        <ApiNotice message={sales.error} />
      ) : (
        <section className="report-metrics">
          <Metric label="Orders" value={sales.data.orders.toLocaleString('en-GB')} tone="orange" />
          <Metric
            label="Total revenue"
            value={<Currency minor={sales.data.totalRevenueMinor} />}
            tone="blue"
          />
          <Metric
            label="Grocery revenue"
            value={<Currency minor={sales.data.groceryRevenueMinor} />}
            tone="green"
          />
          <Metric
            label="Alcohol revenue"
            value={<Currency minor={sales.data.alcoholRevenueMinor} />}
            tone="purple"
          />
        </section>
      )}
      <section className="reports-grid">
        <article className="panel report-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Product performance</p>
              <h2>Top products</h2>
            </div>
            {products.ok && (
              <span className="count-pill">Top {Math.min(products.data.length, 20)}</span>
            )}
          </header>
          {products.ok ? (
            products.data.length > 0 ? (
              <div className="table-wrap">
                <table className="compact-report-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.data.slice(0, 20).map((row) => (
                      <tr key={row.productId}>
                        <td>
                          <strong>{row.name}</strong>
                          <small className="cell-subtext">{row.sku}</small>
                        </td>
                        <td className="numeric-cell">{row.units.toLocaleString('en-GB')}</td>
                        <td className="numeric-cell">
                          <Currency minor={row.revenueMinor} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="panel-empty">Product sales will appear after orders are completed.</p>
            )
          ) : (
            <ApiNotice message={products.error} />
          )}
        </article>
        <div className="report-side-stack">
          <article className="panel report-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Customer activity</p>
                <h2>Customers</h2>
              </div>
            </header>
            {customers.ok ? (
              <>
                <div className="report-summary">
                  <div>
                    <span>Purchasing customers</span>
                    <strong>{customers.data.customers.toLocaleString('en-GB')}</strong>
                  </div>
                  <div>
                    <span>Repeat customers</span>
                    <strong>{customers.data.repeatCustomers.toLocaleString('en-GB')}</strong>
                  </div>
                </div>
                {customers.data.topCustomers.length > 0 && (
                  <div className="rank-list">
                    {customers.data.topCustomers.slice(0, 5).map((row, index) => (
                      <div key={row.userId}>
                        <span className="rank-number">{index + 1}</span>
                        <span className="rank-name">
                          {row.name || row.email || `Customer ${row.userId.slice(0, 8)}`}
                          <small>
                            {row.email && row.name ? `${row.email} · ` : ''}{row.orders} order{row.orders === 1 ? '' : 's'}
                          </small>
                        </span>
                        <strong>
                          <Currency minor={row.spendMinor} />
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <ApiNotice message={customers.error} />
            )}
          </article>
          <article className="panel report-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Promotion performance</p>
                <h2>Coupon usage</h2>
              </div>
            </header>
            {coupons.ok ? (
              coupons.data.length > 0 ? (
                <div className="coupon-report-list">
                  {coupons.data.slice(0, 6).map((row) => (
                    <div key={row.couponId}>
                      <span>
                        <strong>{row.code}</strong>
                        <small>
                          {row.uses} use{row.uses === 1 ? '' : 's'}
                        </small>
                      </span>
                      <span>
                        <Currency minor={row.discountMinor} />
                        <small>discount</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="panel-empty">No coupon usage in this reporting period.</p>
              )
            ) : (
              <ApiNotice message={coupons.error} />
            )}
          </article>
        </div>
      </section>
      <section className="reports-grid section-gap">
        <article className="panel report-panel"><header className="panel-header"><div><p className="eyebrow">Category performance</p><h2>Revenue by category</h2></div></header>{categories.ok && categories.data.length ? <div className="table-wrap"><table><thead><tr><th>Category</th><th>Units</th><th>Revenue</th></tr></thead><tbody>{categories.data.map(row=><tr key={row.categoryId}><td><strong>{row.name}</strong></td><td>{row.units}</td><td><Currency minor={row.revenueMinor}/></td></tr>)}</tbody></table></div> : <p className="panel-empty">No category sales in this period.</p>}</article>
        <article className="panel report-panel"><header className="panel-header"><div><p className="eyebrow">Catalogue action</p><h2>Low-performing products</h2></div></header>{products.ok && products.data.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>{[...products.data].reverse().slice(0,20).map(row=><tr key={row.productId}><td><strong>{row.name}</strong><small className="cell-subtext">{row.sku}</small></td><td>{row.units}</td><td><Currency minor={row.revenueMinor}/></td></tr>)}</tbody></table></div> : <p className="panel-empty">No product sales in this period.</p>}</article>
      </section>
    </>
  );
}
