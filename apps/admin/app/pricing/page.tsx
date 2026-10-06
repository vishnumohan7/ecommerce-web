/* eslint-disable local/no-jsx-literals -- Milestone 17 admin preview is English-only. */
import type { Metadata } from 'next';
import { createCoupon, createInfluencer, createTaxRule, toggleCoupon } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { Currency } from '../components/currency';
import { fetchCoupons, fetchInfluencers, fetchTaxRules } from '../lib/api';

export const metadata: Metadata = { title: 'Pricing & tax' };
export const dynamic = 'force-dynamic';
interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function PricingPage({ searchParams }: PageProps) {
  const [params, couponResult, influencerResult, taxResult] = await Promise.all([
    searchParams,
    fetchCoupons(),
    fetchInfluencers(),
    fetchTaxRules(),
  ]);
  const coupons = couponResult.ok ? couponResult.data : [];
  const influencers = influencerResult.ok ? influencerResult.data : [];
  const rules = taxResult.ok ? taxResult.data : [];
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
        <form action={createCoupon} className="inline-create coupon-form">
          <input name="code" placeholder="WELCOME10" required />
          <select name="type">
            <option value="PERCENTAGE">Percentage (basis points)</option>
            <option value="FIXED">Fixed (pence)</option>
          </select>
          <input name="amount" type="number" min="1" placeholder="Amount" required />
          <select name="appliesTo">
            <option value="BOTH">All baskets</option>
            <option value="GROCERY">Grocery</option>
            <option value="ALCOHOL">Alcohol</option>
          </select>
          <input name="startsAt" type="datetime-local" required />
          <input name="endsAt" type="datetime-local" required />
          <button className="button button-primary" type="submit">
            Create coupon
          </button>
        </form>
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
      <p className="page-note">
        Pricing controls are fetched from protected Milestone 9 endpoints using the server-side
        admin token.
      </p>
    </>
  );
}
