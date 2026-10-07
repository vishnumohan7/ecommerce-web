/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import { createDeliveryZone, toggleDelivery } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { Currency } from '../components/currency';
import { fetchDeliverySlots, fetchDeliveryZones } from '../lib/api';

export const metadata: Metadata = { title: 'Delivery operations' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function DeliveryPage({ searchParams }: PageProps) {
  const [params, zonesResult, slotsResult] = await Promise.all([
    searchParams,
    fetchDeliveryZones(),
    fetchDeliverySlots(),
  ]);
  const zones = zonesResult.ok ? zonesResult.data : [];
  const slots = slotsResult.ok ? slotsResult.data : [];
  const zonesById = new Map(zones.map((zone) => [zone.id, zone.name]));
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Fulfilment</p>
          <h1>Delivery operations</h1>
          <p>Manage postcode zones, fees, slot capacity and age-restricted eligibility.</p>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      {!zonesResult.ok && <ApiNotice message={zonesResult.error} />}
      {!slotsResult.ok && <ApiNotice message={slotsResult.error} />}
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
      <article className="panel section-gap">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Capacity</p>
            <h2>Delivery slots</h2>
          </div>
          <span className="count-pill">{slots.length}</span>
        </header>
        {slots.length === 0 ? (
          <div className="empty-state">
            <h3>No delivery slots</h3>
            <p>Create slots through the API after defining a zone.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Window</th>
                  <th>Capacity</th>
                  <th>Surcharge</th>
                  <th>18+</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id}>
                    <td>{zonesById.get(slot.zoneId) ?? slot.zoneId}</td>
                    <td>
                      {new Intl.DateTimeFormat('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(slot.startsAt))}
                      <small className="cell-subtext">
                        to{' '}
                        {new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' }).format(
                          new Date(slot.endsAt),
                        )}
                      </small>
                    </td>
                    <td>
                      {slot.reserved}/{slot.capacity}
                    </td>
                    <td>
                      <Currency minor={slot.surchargeMinor} />
                    </td>
                    <td>{slot.allowsAgeRestricted ? 'Yes' : 'No'}</td>
                    <td>
                      <span
                        className={`status-badge ${slot.active ? 'status-active' : 'status-down'}`}
                      >
                        <span />
                        {slot.active ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td>
                      <form action={toggleDelivery}>
                        <input type="hidden" name="kind" value="slots" />
                        <input type="hidden" name="id" value={slot.id} />
                        <input type="hidden" name="active" value={String(slot.active)} />
                        <button className="text-action" type="submit">
                          {slot.active ? 'Close' : 'Open'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
      <p className="page-note">
        Reads require delivery.read and writes require delivery.write in ADMIN_API_TOKEN.
      </p>
    </>
  );
}
