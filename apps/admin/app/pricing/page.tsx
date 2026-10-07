/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import { createCoupon, createInfluencer, createTaxRule, toggleCoupon } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { Currency } from '../components/currency';
import { fetchCategories, fetchCoupons, fetchCustomers, fetchInfluencerReport, fetchInfluencers, fetchProducts, fetchTaxRules } from '../lib/api';

export const metadata: Metadata = { title: 'Pricing & tax' };
export const dynamic = 'force-dynamic';
interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function PricingPage({ searchParams }: PageProps) {
  const [params, couponResult, influencerResult, taxResult, productResult, categoryResult, customerResult] = await Promise.all([
    searchParams,
    fetchCoupons(),
    fetchInfluencers(),
    fetchTaxRules(),
    fetchProducts(), fetchCategories(), fetchCustomers(),
  ]);
  const coupons = couponResult.ok ? couponResult.data : [];
  const influencers = influencerResult.ok ? influencerResult.data : [];
  const rules = taxResult.ok ? taxResult.data : [];
  const products = productResult.ok ? productResult.data : [];
  const categories = categoryResult.ok ? categoryResult.data.items : [];
  const customers = customerResult.ok ? customerResult.data : [];
  const influencerReports = await Promise.all(influencers.map(async (item) => ({ id: item.id, result: await fetchInfluencerReport(item.id) })));
  const reportsById = new Map(influencerReports.map((item) => [item.id, item.result]));
  const failure = !couponResult.ok
    ? couponResult.error
    : !influencerResult.ok
      ? influencerResult.error
      : !taxResult.ok
        ? taxResult.error
        : null;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Commercial controls</p>
          <h1>Pricing, coupons & tax</h1>
          <p>Operate discounts, creator attribution and effective-dated UK VAT rules.</p>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      {failure && <ApiNotice message={failure} />}
      <article className="panel section-gap">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Discounts</p>
            <h2>Coupons</h2>
          </div>
          <span className="count-pill">{coupons.length}</span>
        </header>
        <details className="create-disclosure coupon-disclosure">
          <summary><span><strong>Create coupon</strong><small>Set value, eligibility, schedule and usage limits</small></span><b aria-hidden="true">+</b></summary>
          <form action={createCoupon} className="coupon-form">
            <label className="form-field"><span>Coupon code</span><input name="code" placeholder="WELCOME10" required /></label>
            <label className="form-field"><span>Coupon class</span><select name="couponClass"><option value="SITE_WIDE">Site-wide</option><option value="CUSTOMER_CREDIT">Customer credit</option><option value="INFLUENCER">Influencer</option></select></label>
            <label className="form-field"><span>Discount type</span><select name="type"><option value="PERCENTAGE">Percentage (basis points)</option><option value="FIXED">Fixed amount (pence)</option></select></label>
            <label className="form-field"><span>Discount value</span><input name="amount" type="number" min="1" placeholder="e.g. 1000" required /><small>1000 = 10%, or £10 for fixed.</small></label>
            <label className="form-field"><span>Basket scope</span><select name="appliesTo"><option value="BOTH">All baskets</option><option value="GROCERY">Grocery</option><option value="ALCOHOL">Alcohol</option></select></label>
            <label className="form-field"><span>Starts</span><input name="startsAt" type="datetime-local" required /></label>
            <label className="form-field"><span>Ends</span><input name="endsAt" type="datetime-local" required /></label>
            <label className="form-field"><span>Minimum spend</span><input name="minimumSpendMinor" type="number" min="0" placeholder="Pence (optional)" /></label>
            <label className="form-field"><span>Maximum discount</span><input name="maximumDiscountMinor" type="number" min="1" placeholder="Pence (optional)" /></label>
            <label className="form-field"><span>Total use limit</span><input name="maxUses" type="number" min="1" placeholder="Unlimited" /></label>
            <label className="form-field"><span>Uses per customer</span><input name="perCustomerLimit" type="number" min="1" defaultValue="1" /></label>
            <label className="form-field"><span>Influencer</span><select name="influencerId"><option value="">No influencer</option>{influencers.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
            <label className="form-field"><span>Customer restriction</span><select name="lockedUserId"><option value="">Any customer</option>{customers.map(item=><option key={item.id} value={item.id}>{item.email}</option>)}</select></label>
            <label className="form-field coupon-scope-field"><span>Eligible categories</span><select name="categoryIds" multiple>{categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Leave empty for all categories.</small></label>
            <label className="form-field coupon-scope-field"><span>Eligible products</span><select name="productIds" multiple>{products.map(item=><option key={item.id} value={item.id}>{item.name} — {item.sku}</option>)}</select><small>Leave empty for all products.</small></label>
            <label className="form-field"><span>Attribution window</span><input name="attributionWindowDays" type="number" min="1" max="365" defaultValue="30" /><small>Days after influencer referral.</small></label>
            <label className="coupon-checkbox"><input name="firstOrderOnly" type="checkbox" /><span><strong>First order only</strong><small>Restrict redemption to new customers.</small></span></label>
            <div className="coupon-submit"><button className="button button-primary" type="submit">Create coupon</button></div>
          </form>
        </details>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Class</th>
                <th>Value</th>
                <th>Scope</th>
                <th>Usage</th>
                <th>Ends</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <code>{coupon.code}</code>
                  </td>
                  <td>{coupon.couponClass.replaceAll('_', ' ')}</td>
                  <td>
                    {coupon.type === 'PERCENTAGE' ? (
                      `${String((coupon.valueBps ?? 0) / 100)}%`
                    ) : (
                      <Currency minor={coupon.valueMinor ?? 0} currency={coupon.currency} />
                    )}
                  </td>
                  <td>{coupon.appliesTo.toLowerCase()}</td>
                  <td>
                    {coupon.uses}
                    {coupon.maxUses === null ? '' : ` / ${String(coupon.maxUses)}`}
                  </td>
                  <td>{new Date(coupon.endsAt).toLocaleDateString('en-GB')}</td>
                  <td>
                    <span
                      className={`status-badge ${coupon.active ? 'status-active' : 'status-down'}`}
                    >
                      <span />
                      {coupon.active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <form action={toggleCoupon}>
                      <input type="hidden" name="id" value={coupon.id} />
                      <input type="hidden" name="active" value={String(coupon.active)} />
                      <button className="text-action" type="submit">
                        {coupon.active ? 'Pause' : 'Enable'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      <section className="admin-grid section-gap">
        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Attribution</p>
              <h2>Influencers</h2>
            </div>
            <span className="count-pill">{influencers.length}</span>
          </header>
          <form action={createInfluencer} className="inline-create compact-form">
            <input name="displayName" placeholder="Display name" required />
            <input name="code" placeholder="CREATOR_CODE" required />
            <input
              name="commissionBps"
              type="number"
              min="0"
              max="10000"
              placeholder="Commission bps"
              required
            />
            <button className="button button-primary" type="submit">
              Add
            </button>
          </form>
          <div className="record-list">
            {influencers.map((item) => (
              <div className="record-row" key={item.id}>
                <div>
                  <strong>{item.displayName}</strong>
                  <small>{item.code}</small>
                </div>
                <span>{(item.commissionBps / 100).toFixed(2)}%</span>
                <span>{(() => { const report = reportsById.get(item.id); return report?.ok ? `${report.data.orders} orders` : 'Report unavailable'; })()}</span>
                <span className={`status-badge ${item.active ? 'status-active' : 'status-down'}`}>
                  <span />
                  {item.active ? 'Active' : 'Off'}
                </span>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">VAT</p>
              <h2>Tax rules</h2>
            </div>
            <span className="count-pill">{rules.length}</span>
          </header>
          <form action={createTaxRule} className="inline-create compact-form">
            <select name="taxCategory">
              <option>STANDARD_20</option>
              <option>REDUCED_5</option>
              <option>ZERO</option>
              <option>EXEMPT</option>
            </select>
            <input
              name="rateBps"
              type="number"
              min="0"
              max="10000"
              placeholder="Rate bps"
              required
            />
            <input name="effectiveFrom" type="date" required />
            <button className="button button-primary" type="submit">
              Add rule
            </button>
          </form>
          <div className="record-list">
            {rules.map((rule) => (
              <div className="record-row" key={rule.id}>
                <div>
                  <strong>{rule.taxCategory.replaceAll('_', ' ')}</strong>
                  <small>From {new Date(rule.effectiveFrom).toLocaleDateString('en-GB')}</small>
                </div>
                <strong>{(rule.rateBps / 100).toFixed(2)}%</strong>
                <span className={`status-badge ${rule.active ? 'status-active' : 'status-down'}`}>
                  <span />
                  {rule.active ? 'Active' : 'Off'}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
