/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  createCoupon,
  createInfluencer,
  createTaxRule,
  deleteCoupon,
  deleteTaxRule,
  toggleCoupon,
  updateTaxRule,
} from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { ConfirmSubmitButton } from '../components/confirm-submit-button';
import { Currency } from '../components/currency';
import {
  fetchCategories,
  fetchBrands,
  fetchCoupons,
  fetchCustomers,
  fetchInfluencerReport,
  fetchInfluencers,
  fetchProducts,
  fetchTaxRules,
} from '../lib/api';

export const metadata: Metadata = { title: 'Pricing & tax' };
export const dynamic = 'force-dynamic';
interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

const taxCategoryLabels: Record<string, string> = {
  STANDARD_20: 'Standard rate',
  REDUCED_5: 'Reduced rate',
  ZERO: 'Zero rate',
  EXEMPT: 'Exempt',
};

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : '';
}

export default async function PricingPage({ searchParams }: PageProps) {
  const [
    params,
    couponResult,
    influencerResult,
    taxResult,
    productResult,
    categoryResult,
    customerResult,
    brandResult,
  ] = await Promise.all([
    searchParams,
    fetchCoupons(),
    fetchInfluencers(),
    fetchTaxRules(),
    fetchProducts(),
    fetchCategories(),
    fetchCustomers(),
    fetchBrands(),
  ]);
  const coupons = couponResult.ok ? couponResult.data : [];
  const influencers = influencerResult.ok ? influencerResult.data : [];
  const rules = taxResult.ok ? taxResult.data : [];
  const products = productResult.ok ? productResult.data : [];
  const categories = categoryResult.ok ? categoryResult.data.items : [];
  const customers = customerResult.ok ? customerResult.data : [];
  const brands = brandResult.ok ? brandResult.data.items : [];
  const influencerReports = await Promise.all(
    influencers.map(async (item) => ({
      id: item.id,
      result: await fetchInfluencerReport(item.id),
    })),
  );
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
          <summary>
            <span>
              <strong>Create coupon</strong>
              <small>Set value, eligibility, schedule and usage limits</small>
            </span>
            <b aria-hidden="true">+</b>
          </summary>
          <form action={createCoupon} className="coupon-form">
            <label className="form-field">
              <span>Coupon code</span>
              <input name="code" placeholder="WELCOME10" required />
            </label>
            <label className="form-field">
              <span>Coupon class</span>
              <select name="couponClass">
                <option value="SITE_WIDE">Site-wide</option>
                <option value="CUSTOMER_CREDIT">Customer credit</option>
                <option value="INFLUENCER">Influencer</option>
              </select>
            </label>
            <label className="form-field">
              <span>Discount type</span>
              <select name="type">
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </select>
            </label>
            <label className="form-field">
              <span>Discount value</span>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 10"
                required
              />
              <small>Enter 10 for 10% or £10, depending on the selected type.</small>
            </label>
            <label className="form-field">
              <span>Basket scope</span>
              <select name="appliesTo">
                <option value="BOTH">All baskets</option>
                <option value="GROCERY">Grocery</option>
                <option value="ALCOHOL">Alcohol</option>
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
              <span>Minimum spend</span>
              <input
                name="minimumSpendMinor"
                type="number"
                min="0"
                placeholder="Pence (optional)"
              />
            </label>
            <label className="form-field">
              <span>Maximum discount</span>
              <input
                name="maximumDiscountMinor"
                type="number"
                min="1"
                placeholder="Pence (optional)"
              />
            </label>
            <label className="form-field">
              <span>Total use limit</span>
              <input name="maxUses" type="number" min="1" placeholder="Unlimited" />
            </label>
            <label className="form-field">
              <span>Uses per customer</span>
              <input name="perCustomerLimit" type="number" min="1" defaultValue="1" />
            </label>
            <label className="form-field">
              <span>Influencer</span>
              <select name="influencerId">
                <option value="">No influencer</option>
                {influencers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Customer restriction</span>
              <select name="lockedUserId">
                <option value="">Any customer</option>
                {customers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field coupon-scope-field">
              <span>Eligible categories</span>
              <select name="categoryIds" multiple>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <small>Leave empty for all categories.</small>
            </label>
            <label className="form-field coupon-scope-field">
              <span>Eligible products</span>
              <select name="productIds" multiple>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.sku}
                  </option>
                ))}
              </select>
              <small>Leave empty for all products.</small>
            </label>
            <label className="form-field coupon-scope-field">
              <span>Eligible brands</span>
              <select name="brandIds" multiple>
                {brands.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <small>Leave empty for all brands.</small>
            </label>
            <label className="form-field">
              <span>Attribution window</span>
              <input
                name="attributionWindowDays"
                type="number"
                min="1"
                max="365"
                defaultValue="30"
              />
              <small>Days after influencer referral.</small>
            </label>
            <label className="coupon-checkbox">
              <input name="firstOrderOnly" type="checkbox" />
              <span>
                <strong>First order only</strong>
                <small>Restrict redemption to new customers.</small>
              </span>
            </label>
            <div className="coupon-submit">
              <button className="button button-primary" type="submit">
                Create coupon
              </button>
            </div>
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
                  <td className="coupon-row-actions">
                    <Link className="text-action" href={`/pricing/coupons/${coupon.id}`}>
                      View / edit
                    </Link>
                    <form action={toggleCoupon}>
                      <input type="hidden" name="id" value={coupon.id} />
                      <input type="hidden" name="active" value={String(coupon.active)} />
                      <button className="text-action" type="submit">
                        {coupon.active ? 'Pause' : 'Enable'}
                      </button>
                    </form>
                    <form action={deleteCoupon}>
                      <input type="hidden" name="id" value={coupon.id} />
                      <ConfirmSubmitButton
                        message={`Delete coupon ${coupon.code}? Used coupons must be paused instead.`}
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      <section className="pricing-secondary section-gap">
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
                <span>
                  {(() => {
                    const report = reportsById.get(item.id);
                    return report?.ok
                      ? `${String(report.data.orders)} orders`
                      : 'Report unavailable';
                  })()}
                </span>
                <span className={`status-badge ${item.active ? 'status-active' : 'status-down'}`}>
                  <span />
                  {item.active ? 'Active' : 'Off'}
                </span>
              </div>
            ))}
          </div>
        </article>
        <article className="panel tax-rules-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">VAT</p>
              <h2>Tax rules</h2>
              <small>Rates are entered as percentages and can be scheduled by date.</small>
            </div>
            <span className="count-pill">{rules.length}</span>
          </header>
          <details className="create-disclosure tax-rule-create">
            <summary>
              <span>
                <strong>Add tax rule</strong>
                <small>Create a VAT rate and effective date window</small>
              </span>
              <b aria-hidden="true">+</b>
            </summary>
            <form action={createTaxRule} className="tax-rule-form">
              <label className="form-field">
                <span>Tax category</span>
                <select name="taxCategory">
                  <option value="STANDARD_20">Standard rate</option>
                  <option value="REDUCED_5">Reduced rate</option>
                  <option value="ZERO">Zero rate</option>
                  <option value="EXEMPT">Exempt</option>
                </select>
              </label>
              <label className="form-field">
                <span>VAT rate (%)</span>
                <input
                  name="ratePercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="20.00"
                  required
                />
              </label>
              <label className="form-field">
                <span>Effective from</span>
                <input name="effectiveFrom" type="date" required />
              </label>
              <label className="form-field">
                <span>Effective until</span>
                <input name="effectiveTo" type="date" />
                <small>Optional</small>
              </label>
              <div className="tax-rule-submit">
                <button className="button button-primary" type="submit">
                  Create tax rule
                </button>
              </div>
            </form>
          </details>
          <div className="tax-rule-list">
            {rules.length === 0 ? (
              <div className="empty-state">
                <strong>No tax rules configured</strong>
                <p>Add the required UK VAT rates before accepting orders.</p>
              </div>
            ) : (
              rules.map((rule) => (
                <details className="tax-rule-editor" key={rule.id}>
                  <summary>
                    <span className="tax-rule-name">
                      <strong>{taxCategoryLabels[rule.taxCategory] ?? rule.taxCategory}</strong>
                      <small>{rule.taxCategory}</small>
                    </span>
                    <strong className="tax-rule-rate">{(rule.rateBps / 100).toFixed(2)}%</strong>
                    <span className="tax-rule-window">
                      {new Date(rule.effectiveFrom).toLocaleDateString('en-GB')} —{' '}
                      {rule.effectiveTo
                        ? new Date(rule.effectiveTo).toLocaleDateString('en-GB')
                        : 'No end date'}
                    </span>
                    <span
                      className={`status-badge ${rule.active ? 'status-active' : 'status-down'}`}
                    >
                      <span />
                      {rule.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-action">Edit</span>
                  </summary>
                  <div className="tax-rule-edit-body">
                    <form action={updateTaxRule} className="tax-rule-form">
                      <input type="hidden" name="id" value={rule.id} />
                      <label className="form-field">
                        <span>Tax category</span>
                        <select name="taxCategory" defaultValue={rule.taxCategory}>
                          <option value="STANDARD_20">Standard rate</option>
                          <option value="REDUCED_5">Reduced rate</option>
                          <option value="ZERO">Zero rate</option>
                          <option value="EXEMPT">Exempt</option>
                        </select>
                      </label>
                      <label className="form-field">
                        <span>VAT rate (%)</span>
                        <input
                          name="ratePercent"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          defaultValue={(rule.rateBps / 100).toFixed(2)}
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span>Effective from</span>
                        <input
                          name="effectiveFrom"
                          type="date"
                          defaultValue={dateInputValue(rule.effectiveFrom)}
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span>Effective until</span>
                        <input
                          name="effectiveTo"
                          type="date"
                          defaultValue={dateInputValue(rule.effectiveTo)}
                        />
                        <small>Optional</small>
                      </label>
                      <label className="tax-rule-active">
                        <input name="active" type="checkbox" defaultChecked={rule.active} />
                        <span>Active</span>
                      </label>
                      <button className="button button-primary" type="submit">
                        Save changes
                      </button>
                    </form>
                    <form action={deleteTaxRule} className="tax-rule-delete">
                      <input type="hidden" name="id" value={rule.id} />
                      <ConfirmSubmitButton
                        message={`Delete the ${taxCategoryLabels[rule.taxCategory] ?? rule.taxCategory} rule? The current effective rule can only be deleted after a replacement is configured.`}
                      >
                        Delete rule
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </details>
              ))
            )}
          </div>
        </article>
      </section>
    </>
  );
}
