/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import { createDeliveryZone, toggleDelivery, updateDeliveryPricing } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { Currency } from '../components/currency';
import { fetchDeliveryPolicy, fetchDeliveryZones } from '../lib/api';

export const metadata: Metadata = { title: 'Delivery operations' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function DeliveryPage({ searchParams }: PageProps) {
  const [params, zonesResult, policyResult] = await Promise.all([
    searchParams,
    fetchDeliveryZones(),
    fetchDeliveryPolicy(),
  ]);
  const zones = zonesResult.ok ? zonesResult.data : [];
  const saturdaySurchargeMinor = policyResult.ok ? policyResult.data.saturdaySurchargeMinor : '150';
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Fulfilment</p>
          <h1>Delivery operations</h1>
          <p>Manage London coverage and the fixed standard and Saturday delivery charges.</p>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      {!zonesResult.ok && <ApiNotice message={zonesResult.error} />}
      {!policyResult.ok && <ApiNotice message={policyResult.error} />}
      <article className="panel section-gap">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Service areas</p>
            <h2>Delivery zones</h2>
          </div>
          <span className="count-pill">{zones.length}</span>
        </header>
        <form action={createDeliveryZone} className="inline-create zone-form">
          <input name="code" placeholder="LONDON_CENTRAL" pattern="[A-Za-z0-9_-]+" required />
          <input name="name" placeholder="Zone name" required />
          <input name="postcodePatterns" placeholder="SW*, SE1*, WC*" required />
          <input name="feeMinor" type="number" min="0" placeholder="Fee (pence)" required />
          <button className="button button-primary" type="submit">
            Add zone
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Zone</th>
                <th>Postcodes</th>
                <th>Grocery fee</th>
                <th>Alcohol fee</th>
                <th>Alcohol</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id}>
                  <td>
                    <strong>{zone.name}</strong>
                    <small className="cell-subtext">{zone.code}</small>
                  </td>
                  <td>{zone.postcodePatterns.join(', ')}</td>
                  <td>
                    <Currency minor={zone.groceryFeeMinor} />
                  </td>
                  <td>
                    <Currency minor={zone.alcoholFeeMinor} />
                  </td>
                  <td>{zone.alcoholDeliveryAllowed ? 'Allowed' : 'Blocked'}</td>
                  <td>
                    <span
                      className={`status-badge ${zone.active ? 'status-active' : 'status-down'}`}
                    >
                      <span />
                      {zone.active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <form action={toggleDelivery}>
                      <input type="hidden" name="kind" value="zones" />
                      <input type="hidden" name="id" value={zone.id} />
                      <input type="hidden" name="active" value={String(zone.active)} />
                      <button className="text-action" type="submit">
                        {zone.active ? 'Pause' : 'Enable'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      {zones.map((zone) => (
        <article className="panel section-gap" key={`pricing-${zone.id}`}>
          <header className="panel-header">
            <div>
              <p className="eyebrow">Delivery pricing</p>
              <h2>{zone.name}</h2>
            </div>
          </header>
          <form action={updateDeliveryPricing} className="inline-create compact-form">
            <input type="hidden" name="zoneId" value={zone.id} />
            <label>
              Fixed London charge (pence)
              <input
                name="fixedFeeMinor"
                type="number"
                min="0"
                defaultValue={zone.groceryFeeMinor}
                required
              />
            </label>
            <label>
              Saturday surcharge (pence)
              <input
                name="saturdaySurchargeMinor"
                type="number"
                min="0"
                defaultValue={saturdaySurchargeMinor}
                required
              />
            </label>
            <button className="button button-primary" type="submit">
              Save pricing
            </button>
          </form>
          <div className="panel-body">
            <p>
              Orders placed Monday–Thursday are delivered the next day. Friday orders can use paid
              Saturday delivery or standard Tuesday delivery. Weekend orders use standard Tuesday
              delivery.
            </p>
          </div>
        </article>
      ))}
    </>
  );
}
