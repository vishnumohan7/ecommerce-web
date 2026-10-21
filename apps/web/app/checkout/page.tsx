'use client';
/* eslint-disable local/no-jsx-literals */
import { SyntheticEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserApi, money } from '../../lib/store-api';

interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  feeMinor?: string;
}
interface Summary {
  totalMinor: string;
  currency: string;
  requiresAgeVerification: boolean;
  requiresManualCapture: boolean;
  delivery: { options: Slot[] };
  groups: Array<{ category: string; lines: unknown[] }>;
}
export default function CheckoutPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [details, setDetails] = useState({
    line1: '',
    line2: '',
    city: '',
    postcode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    slotId: '',
    dateOfBirth: '',
  });
  async function validateAddress(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      const result = await browserApi<Summary>('/api/v1/checkout/validate', {
        method: 'POST',
        body: JSON.stringify({
          deliveryAddress: {
            line1: details.line1,
            line2: details.line2 || undefined,
            city: details.city,
            postcode: details.postcode,
            country: 'GB',
          },
        }),
      });
      setSummary(result);
      setSlots(result.delivery.options);
      setStep(2);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to validate checkout');
    }
  }
  async function createSession() {
    setError('');
    try {
      const session = await browserApi<{ id: string }>('/api/v1/checkout/session', {
        method: 'POST',
        body: JSON.stringify({
          deliveryAddress: {
            line1: details.line1,
            line2: details.line2 || undefined,
            city: details.city,
            postcode: details.postcode,
            country: 'GB',
          },
          deliverySlotId: details.slotId,
          guest: {
            firstName: details.firstName,
            lastName: details.lastName,
            email: details.email,
            phone: details.phone,
          },
        }),
      });
      setSessionId(session.id);
      setStep(4);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reserve checkout');
    }
  }
  function continueFromDelivery() {
    if (summary?.requiresAgeVerification) {
      setError('');
      setStep(3);
      return;
    }
    void createSession();
  }
  async function verifyAge() {
    setError('');
    try {
      const verification = await browserApi<{ status: string; isOver18: boolean }>(
        '/api/v1/age-verification/dob',
        {
          method: 'POST',
          body: JSON.stringify({ dateOfBirth: details.dateOfBirth }),
        },
      );
      if (!verification.isOver18 || verification.status !== 'PASSED') {
        setError('You must be aged 18 or over to purchase age-restricted products.');
        return;
      }
      await createSession();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to verify age');
    }
  }
  async function pay() {
    setError('');
    try {
      const order = await browserApi<{ id?: string; orderId: string; status: string }>(
        '/api/v1/payments/cash-on-delivery',
        { method: 'POST', body: JSON.stringify({ checkoutSessionId: sessionId }) },
      );
      router.push(
        `/order-confirmation?order=${encodeURIComponent(order.orderId)}&payment=${encodeURIComponent(order.id ?? '')}&status=${encodeURIComponent(order.status)}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Order could not be placed');
    }
  }
  useEffect(() => {
    const onlySlot = slots[0];
    if (step === 2 && slots.length === 1 && onlySlot && !details.slotId)
      setDetails((value) => ({ ...value, slotId: onlySlot.id }));
  }, [step, slots, details.slotId]);
  return (
    <main className="section narrow">
      <p className="eyebrow">Secure checkout</p>
      <h1>Checkout</h1>
      <ol className="steps">
        <li className={step >= 1 ? 'active' : ''}>Address</li>
        <li className={step >= 2 ? 'active' : ''}>Delivery</li>
        <li className={step >= 3 ? 'active' : ''}>Age check</li>
        <li className={step >= 4 ? 'active' : ''}>Place order</li>
      </ol>
      {step === 1 && (
        <form className="form-card" onSubmit={(event) => void validateAddress(event)}>
          <h2>Delivery details</h2>
          <div className="form-grid">
            <label>
              First name
              <input
                required
                value={details.firstName}
                onChange={(e) => {
                  setDetails({ ...details, firstName: e.target.value });
                }}
              />
            </label>
            <label>
              Last name
              <input
                required
                value={details.lastName}
                onChange={(e) => {
                  setDetails({ ...details, lastName: e.target.value });
                }}
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={details.email}
                onChange={(e) => {
                  setDetails({ ...details, email: e.target.value });
                }}
              />
            </label>
            <label>
              Phone
              <input
                required
                type="tel"
                value={details.phone}
                onChange={(e) => {
                  setDetails({ ...details, phone: e.target.value });
                }}
              />
            </label>
            <label className="span-2">
              Address line 1
              <input
                required
                value={details.line1}
                onChange={(e) => {
                  setDetails({ ...details, line1: e.target.value });
                }}
              />
            </label>
            <label>
              Town or city
              <input
                required
                value={details.city}
                onChange={(e) => {
                  setDetails({ ...details, city: e.target.value });
                }}
              />
            </label>
            <label>
              Postcode
              <input
                required
                value={details.postcode}
                onChange={(e) => {
                  setDetails({ ...details, postcode: e.target.value.toUpperCase() });
                }}
              />
            </label>
          </div>
          <button className="button">Find delivery options</button>
        </form>
      )}
      {step === 2 && (
        <section className="form-card">
          <h2>Choose a delivery slot</h2>
          {slots.length ? (
            <div className="slot-grid">
              {slots.map((slot) => (
                <label key={slot.id} className={details.slotId === slot.id ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="slot"
                    checked={details.slotId === slot.id}
                    onChange={() => {
                      setDetails({ ...details, slotId: slot.id });
                    }}
                  />
                  <strong>
                    {new Date(slot.startsAt).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </strong>
                  <span>
                    {new Date(slot.startsAt).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    –
                    {new Date(slot.endsAt).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No delivery slots are currently available for this postcode.
            </div>
          )}
          <button className="button" disabled={!details.slotId} onClick={continueFromDelivery}>
            Continue
          </button>
        </section>
      )}
      {step === 3 && (
        <section className="form-card">
          <div className="age-badge">18+</div>
          <h2>Age verification</h2>
          <p>
            Enter your date of birth to confirm purchase eligibility. Challenge 25 still applies at
            delivery and the order cannot be left unattended.
          </p>
          <label>
            Date of birth
            <input
              type="date"
              required
              autoComplete="bday"
              value={details.dateOfBirth}
              onChange={(e) => {
                setDetails({ ...details, dateOfBirth: e.target.value });
              }}
            />
          </label>
          <button
            className="button"
            disabled={!details.dateOfBirth}
            onClick={() => void verifyAge()}
          >
            Verify age and reserve slot
          </button>
        </section>
      )}
      {step === 4 && (
        <section className="form-card">
          <h2>Review and place order</h2>
          {summary && (
            <>
              <dl className="checkout-total">
                <dt>Cash due on delivery</dt>
                <dd>{money(summary.totalMinor, summary.currency)}</dd>
              </dl>
              {summary.requiresManualCapture && (
                <div className="notice">
                  Some items are priced by actual weight. The final payable amount will be confirmed
                  after picking.
                </div>
              )}
            </>
          )}
          <p>
            Payment method: Cash on Delivery. Please have the confirmed amount available when the
            order arrives.
          </p>
          <button className="button full" onClick={() => void pay()} disabled={!sessionId}>
            Place Cash on Delivery order
          </button>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
