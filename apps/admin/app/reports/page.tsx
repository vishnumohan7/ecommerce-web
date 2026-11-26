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
  fetchProfitReport,
  fetchSalesReport,
  type ProfitReportRow,
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

function Percentage({ basisPoints }: { basisPoints: number | null }) {
  return <>{basisPoints === null ? 'Unavailable' : `${(basisPoints / 100).toFixed(1)}%`}</>;
}

function ProfitTable({
  rows,
  includeSku = false,
}: {
  rows: ProfitReportRow[];
  includeSku?: boolean;
}) {
  return rows.length > 0 ? (
    <div className="table-wrap">
      <table className="profit-report-table">
        <thead>
          <tr>
            <th>{includeSku ? 'Product' : 'Group'}</th>
            <th>Revenue</th>
            <th>Cost</th>
            <th>Gross profit</th>
            <th>Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.name}</strong>
                {includeSku && row.sku ? <small className="cell-subtext">{row.sku}</small> : null}
                {row.missingCostLines > 0 ? (
                  <small className="cost-warning">
                    {row.missingCostLines} line{row.missingCostLines === 1 ? '' : 's'} missing cost
                  </small>
                ) : null}
              </td>
              <td>
                <Currency minor={row.revenueMinor} />
              </td>
              <td>
                <Currency minor={row.costOfGoodsMinor} />
              </td>
              <td>
                <strong>
                  <Currency minor={row.grossProfitMinor} />
                </strong>
              </td>
              <td>
                <Percentage basisPoints={row.grossMarginBps} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="panel-empty">No qualifying sales in this reporting period.</p>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportFilters>;
}) {
  const params = await searchParams;
  const [
    sales,
    profit,
    customers,
    products,
    coupons,
    categories,
    productOptions,
    categoryOptions,
    customerOptions,
    couponOptions,
  ] = await Promise.all([
    fetchSalesReport(params),
    fetchProfitReport(params),
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
          <div>
            <strong>Report filters</strong>
            <small>
              {activeFilters ? `${String(activeFilters)} active` : 'All completed orders'}
            </small>
          </div>
          {activeFilters > 0 && (
            <a className="text-action" href="/reports">
              Reset all
            </a>
          )}
        </div>
        <div className="report-filter-grid">
          <label>
            From
            <input name="from" type="date" defaultValue={params.from} />
          </label>
          <label>
            To
            <input name="to" type="date" defaultValue={params.to} />
          </label>
          <label>
            Product
            <select name="productId" defaultValue={params.productId ?? ''}>
              <option value="">All products</option>
              {productOptions.ok &&
                productOptions.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.sku}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Category
            <select name="categoryId" defaultValue={params.categoryId ?? ''}>
              <option value="">All categories</option>
              {categoryOptions.ok &&
                categoryOptions.data.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Customer
            <select name="customerId" defaultValue={params.customerId ?? ''}>
              <option value="">All customers</option>
              {customerOptions.ok &&
                customerOptions.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.firstName} {item.lastName} — {item.email}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Coupon
            <select name="couponId" defaultValue={params.couponId ?? ''}>
              <option value="">All coupons</option>
              {couponOptions.ok &&
                couponOptions.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Basket
            <select name="basketType" defaultValue={params.basketType ?? ''}>
              <option value="">All baskets</option>
              <option value="GROCERY">Grocery</option>
              <option value="ALCOHOL">Alcohol</option>
              <option value="MIXED">Mixed</option>
            </select>
          </label>
          <label>
            Product group
            <select name="department" defaultValue={params.department ?? ''}>
              <option value="">Grocery and alcohol</option>
              <option value="GROCERY">Grocery only</option>
              <option value="ALCOHOL">Alcohol only</option>
            </select>
          </label>
          <label>
            Payment
            <select name="paymentStatus" defaultValue={params.paymentStatus ?? ''}>
              <option value="">All payment states</option>
              <option value="CAPTURED">Captured</option>
              <option value="AUTHORISED">Authorised</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIALLY_REFUNDED">Partially refunded</option>
              <option value="REFUNDED">Refunded</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <label>
            Fulfilment
            <select name="fulfilmentStatus" defaultValue={params.fulfilmentStatus ?? ''}>
              <option value="">All fulfilment states</option>
              {[
                'PENDING',
                'CONFIRMED',
                'PICKING',
                'PICKED',
                'OUT_FOR_DELIVERY',
                'DELIVERED',
                'REFUSED',
                'CANCELLED',
              ].map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="report-filter-actions">
          <button className="button button-primary" type="submit">
            Generate report
          </button>
          <a className="button button-muted" href="/reports">
            Clear filters
          </a>
        </div>
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
      <section className="profit-report-section section-gap">
        <div className="page-heading compact-heading">
          <div>
            <p className="eyebrow">Profitability</p>
            <h2>Gross profit report</h2>
            <p>
              Merchandise revenue less recorded product cost. Delivery income, payment fees and
              operating overheads are excluded.
            </p>
          </div>
        </div>
        {!profit.ok ? (
          <ApiNotice message={profit.error} />
        ) : (
          <>
            {profit.data.totals.missingCostLines > 0 && (
              <div className="profit-coverage-notice">
                <strong>Incomplete cost coverage</strong>
                <span>
                  Profit uses {(profit.data.totals.costCoverageBps / 100).toFixed(1)}% of filtered
                  merchandise revenue. Add cost prices to products and variants; historical lines
                  without a cost snapshot remain excluded.
                </span>
              </div>
            )}
            <div className="report-metrics profit-metrics">
              <Metric
                label="Merchandise revenue"
                value={<Currency minor={profit.data.totals.revenueMinor} />}
                tone="blue"
              />
              <Metric
                label="Recorded cost of goods"
                value={<Currency minor={profit.data.totals.costOfGoodsMinor} />}
                tone="orange"
              />
              <Metric
                label="Gross profit"
                value={<Currency minor={profit.data.totals.grossProfitMinor} />}
                tone="green"
              />
              <Metric
                label="Gross margin"
                value={<Percentage basisPoints={profit.data.totals.grossMarginBps} />}
                tone="purple"
              />
            </div>
            <div className="profit-report-grid">
              <article className="panel report-panel">
                <header className="panel-header">
                  <div>
                    <p className="eyebrow">Product group</p>
                    <h2>Grocery and alcohol</h2>
                  </div>
                </header>
                <ProfitTable rows={profit.data.byDepartment} />
              </article>
              <article className="panel report-panel">
                <header className="panel-header">
                  <div>
                    <p className="eyebrow">Category analysis</p>
                    <h2>Profit by category</h2>
                  </div>
                </header>
                <ProfitTable rows={profit.data.byCategory} />
              </article>
            </div>
            <article className="panel report-panel section-gap">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Product analysis</p>
                  <h2>Profit by product</h2>
                </div>
                <span className="count-pill">{profit.data.byProduct.length} products</span>
              </header>
              <ProfitTable rows={profit.data.byProduct} includeSku />
            </article>
          </>
        )}
      </section>
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
                            {row.email && row.name ? `${row.email} · ` : ''}
                            {row.orders} order{row.orders === 1 ? '' : 's'}
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
        <article className="panel report-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Category performance</p>
              <h2>Revenue by category</h2>
            </div>
          </header>
          {categories.ok && categories.data.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Units</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.data.map((row) => (
                    <tr key={row.categoryId}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>{row.units}</td>
                      <td>
                        <Currency minor={row.revenueMinor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-empty">No category sales in this period.</p>
          )}
        </article>
        <article className="panel report-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Catalogue action</p>
              <h2>Low-performing products</h2>
            </div>
          </header>
          {products.ok && products.data.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {[...products.data]
                    .reverse()
                    .slice(0, 20)
                    .map((row) => (
                      <tr key={row.productId}>
                        <td>
                          <strong>{row.name}</strong>
                          <small className="cell-subtext">{row.sku}</small>
                        </td>
                        <td>{row.units}</td>
                        <td>
                          <Currency minor={row.revenueMinor} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-empty">No product sales in this period.</p>
          )}
        </article>
      </section>
    </>
  );
}
