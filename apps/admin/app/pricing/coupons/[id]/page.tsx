/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { deleteCoupon, updateCoupon } from '../../../actions';
import { ActionMessage } from '../../../components/action-message';
import { ApiNotice } from '../../../components/api-notice';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { Currency } from '../../../components/currency';
import {
  fetchBrands,
  fetchCategories,
  fetchCoupon,
  fetchCustomers,
  fetchInfluencers,
  fetchProducts,
} from '../../../lib/api';

export const metadata: Metadata = { title: 'Coupon detail' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}

function dateTimeInput(value: string) {
  return new Date(value).toISOString().slice(0, 16);
}

export default async function CouponDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [
    couponResult,
    productResult,
    categoryResult,
    brandResult,
    influencerResult,
    customerResult,
  ] = await Promise.all([
    fetchCoupon(id),
    fetchProducts(),
    fetchCategories(),
    fetchBrands(),
    fetchInfluencers(),
    fetchCustomers(),
  ]);

  if (!couponResult.ok)
    return (
      <>
        <section className="page-heading compact-heading">
          <div>
            <p className="eyebrow">Coupon detail</p>
            <h1>Coupon unavailable</h1>
          </div>
          <Link className="button button-muted" href="/pricing">
            Back to pricing
          </Link>
        </section>
        <ApiNotice message={couponResult.error} />
      </>
    );

  const coupon = couponResult.data;
  const products = productResult.ok ? productResult.data : [];
  const categories = categoryResult.ok ? categoryResult.data.items : [];
  const brands = brandResult.ok ? brandResult.data.items : [];
  const influencers = influencerResult.ok ? influencerResult.data : [];
  const customers = customerResult.ok ? customerResult.data : [];
  const dependencyFailure = !productResult.ok
    ? productResult.error
    : !categoryResult.ok
      ? categoryResult.error
      : !brandResult.ok
        ? brandResult.error
        : !influencerResult.ok
          ? influencerResult.error
          : !customerResult.ok
            ? customerResult.error
            : null;
  const discountValue =
    coupon.type === 'PERCENTAGE'
      ? (coupon.valueBps ?? 0) / 100
      : Number(coupon.valueMinor ?? 0) / 100;

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Coupon detail</p>
          <h1>{coupon.code}</h1>
          <p>Review eligibility, usage limits, schedule and discount value.</p>
        </div>
        <div className="heading-actions">
          <Link className="button button-muted" href="/pricing">
            Back to pricing
          </Link>
          <form action={deleteCoupon}>
            <input type="hidden" name="id" value={coupon.id} />
            <ConfirmSubmitButton
              className="button button-danger"
              message={`Delete coupon ${coupon.code}? This cannot be undone.`}
            >
              Delete coupon
            </ConfirmSubmitButton>
          </form>
        </div>
      </section>
      <ActionMessage success={query.success} error={query.error} />
      {dependencyFailure && <ApiNotice message={dependencyFailure} />}

      <section className="coupon-summary-grid section-gap">
        <article className="panel coupon-summary-card">
          <span>Status</span>
          <strong>{coupon.active ? 'Active' : 'Paused'}</strong>
        </article>
        <article className="panel coupon-summary-card">
          <span>Discount</span>
          <strong>
            {coupon.type === 'PERCENTAGE' ? (
              `${String(discountValue)}%`
            ) : (
              <Currency minor={coupon.valueMinor ?? 0} currency={coupon.currency} />
            )}
          </strong>
        </article>
        <article className="panel coupon-summary-card">
          <span>Usage</span>
          <strong>
            {coupon.uses}
            {coupon.maxUses === null ? ' / Unlimited' : ` / ${String(coupon.maxUses)}`}
          </strong>
        </article>
        <article className="panel coupon-summary-card">
          <span>Valid until</span>
          <strong>{new Date(coupon.endsAt).toLocaleDateString('en-GB')}</strong>
        </article>
      </section>

      <article className="panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Configuration</p>
            <h2>Edit coupon</h2>
          </div>
          <span className={`status-badge ${coupon.active ? 'status-active' : 'status-down'}`}>
            <span />
            {coupon.active ? 'Active' : 'Paused'}
          </span>
        </header>
        <form action={updateCoupon} className="coupon-form coupon-detail-form">
          <input type="hidden" name="id" value={coupon.id} />
          <label className="form-field">
            <span>Coupon code</span>
            <input value={coupon.code} readOnly aria-readonly="true" />
            <small>Codes cannot be changed after creation.</small>
          </label>
          <label className="form-field">
            <span>Coupon class</span>
            <select name="couponClass" defaultValue={coupon.couponClass}>
              <option value="SITE_WIDE">Site-wide</option>
              <option value="CUSTOMER_CREDIT">Customer credit</option>
              <option value="INFLUENCER">Influencer</option>
            </select>
          </label>
          <label className="form-field">
            <span>Discount type</span>
            <select name="type" defaultValue={coupon.type}>
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
              max={coupon.type === 'PERCENTAGE' ? '100' : undefined}
              step="0.01"
              defaultValue={discountValue}
              required
            />
            <small>Enter a percentage or GBP amount to match the selected type.</small>
          </label>
          <label className="form-field">
            <span>Basket scope</span>
            <select name="appliesTo" defaultValue={coupon.appliesTo}>
              <option value="BOTH">All baskets</option>
              <option value="GROCERY">Grocery</option>
              <option value="ALCOHOL">Alcohol</option>
            </select>
          </label>
          <label className="form-field">
            <span>Starts</span>
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={dateTimeInput(coupon.startsAt)}
              required
            />
          </label>
          <label className="form-field">
            <span>Ends</span>
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={dateTimeInput(coupon.endsAt)}
              required
            />
          </label>
          <label className="form-field">
            <span>Minimum spend (pence)</span>
            <input
              name="minimumSpendMinor"
              type="number"
              min="0"
              defaultValue={coupon.minimumSpendMinor ?? ''}
              placeholder="No minimum"
            />
          </label>
          <label className="form-field">
            <span>Maximum discount (pence)</span>
            <input
              name="maximumDiscountMinor"
              type="number"
              min="1"
              defaultValue={coupon.maximumDiscountMinor ?? ''}
              placeholder="No maximum"
            />
          </label>
          <label className="form-field">
            <span>Total use limit</span>
            <input
              name="maxUses"
              type="number"
              min={Math.max(1, coupon.uses)}
              defaultValue={coupon.maxUses ?? ''}
              placeholder="Unlimited"
            />
          </label>
          <label className="form-field">
            <span>Uses per customer</span>
            <input
              name="perCustomerLimit"
              type="number"
              min="1"
              defaultValue={coupon.perCustomerLimit ?? ''}
              placeholder="Unlimited"
            />
          </label>
          <label className="form-field">
            <span>Attribution window</span>
            <input
              name="attributionWindowDays"
              type="number"
              min="1"
              max="365"
              defaultValue={coupon.attributionWindowDays}
            />
            <small>Days after an influencer referral.</small>
          </label>
          <label className="form-field">
            <span>Influencer</span>
            <select name="influencerId" defaultValue={coupon.influencerId ?? ''}>
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
            <select name="lockedUserId" defaultValue={coupon.lockedUserId ?? ''}>
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
            <select name="categoryIds" multiple defaultValue={coupon.categoryIds}>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <small>Leave empty for all categories.</small>
          </label>
          <label className="form-field coupon-scope-field">
            <span>Eligible brands</span>
            <select name="brandIds" multiple defaultValue={coupon.brandIds}>
              {brands.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <small>Leave empty for all brands.</small>
          </label>
          <label className="form-field coupon-scope-field">
            <span>Eligible products</span>
            <select name="productIds" multiple defaultValue={coupon.productIds}>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.sku}
                </option>
              ))}
            </select>
            <small>Leave empty for all products.</small>
          </label>
          <label className="coupon-checkbox">
            <input name="firstOrderOnly" type="checkbox" defaultChecked={coupon.firstOrderOnly} />
            <span>
              <strong>First order only</strong>
              <small>Restrict redemption to new customers.</small>
            </span>
          </label>
          <label className="coupon-checkbox">
            <input name="active" type="checkbox" defaultChecked={coupon.active} />
            <span>
              <strong>Coupon active</strong>
              <small>Customers can redeem this coupon while active and within schedule.</small>
            </span>
          </label>
          <div className="coupon-submit">
            <button className="button button-primary" type="submit">
              Save coupon
            </button>
          </div>
        </form>
      </article>
      {coupon.uses > 0 && (
        <p className="coupon-history-note">
          This coupon has redemption history. It can be edited or paused, but cannot be deleted.
        </p>
      )}
    </>
  );
}
