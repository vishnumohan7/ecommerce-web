/* eslint-disable local/no-jsx-literals */
import type { ReactNode } from 'react';
import { ApiNotice } from '../components/api-notice';
import { Currency } from '../components/currency';
import {
  fetchCouponReport,
  fetchCustomerReport,
  fetchProductReport,
  fetchSalesReport,
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

export default async function ReportsPage() {
  const [sales, customers, products, coupons] = await Promise.all([
    fetchSalesReport(),
    fetchCustomerReport(),
    fetchProductReport(),
    fetchCouponReport(),
  ]);
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Business intelligence</p>
          <h1>Reports</h1>
          <p>Sales, product and customer performance from completed orders.</p>
        </div>
      </section>
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
                          Customer {row.userId.slice(0, 8)}
                          <small>
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
    </>
  );
}
