'use client';
/* eslint-disable local/no-jsx-literals -- Storefront account copy is currently English-only. */

import Link from 'next/link';
import { SyntheticEvent, useCallback, useEffect, useState } from 'react';
import { browserApi } from '../../lib/store-api';
import { AccountSidebar } from '../components/account-sidebar';

interface Address {
  id: string;
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  postcode: string;
  country: string;
  isDefault: boolean;
}

export default function AddressesPage() {
  const [items, setItems] = useState<Address[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(
    () =>
      browserApi<Address[]>('/api/v1/addresses')
        .then(setItems)
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : 'Could not load addresses');
        }),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function create(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setMessage('Saving address…');
    try {
      await browserApi('/api/v1/addresses', {
        method: 'POST',
        body: JSON.stringify({ ...values, country: 'GB', isDefault: values.isDefault === 'on' }),
      });
      form.reset();
      setError('');
      setMessage('Address saved.');
      await load();
    } catch (reason) {
      setMessage('');
      setError(reason instanceof Error ? reason.message : 'Could not save address');
    }
  }
  async function remove(id: string) {
    await browserApi(`/api/v1/addresses/${id}`, { method: 'DELETE' });
    await load();
  }
  async function makeDefault(id: string) {
    await browserApi(`/api/v1/addresses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isDefault: true }),
    });
    await load();
  }
  if (error && items === null)
    return (
      <main className="account-page account-page-narrow">
        <div className="empty-state account-empty">
          <h1>Sign in to manage addresses</h1>
          <p>{error}</p>
          <Link className="button" href="/auth/login">
            Sign in
          </Link>
        </div>
      </main>
    );

  return (
    <main className="account-page">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>Saved addresses</strong>
      </div>
      <section className="account-welcome">
        <p className="eyebrow">My account</p>
        <h1>Saved addresses</h1>
        <p>Manage the delivery addresses available during checkout.</p>
      </section>
      <div className="account-dashboard">
        <AccountSidebar active="addresses" />
        <section className="account-main">
          <div className="address-book-layout">
            <section className="account-panel">
              <div className="account-panel-heading">
                <div>
                  <p className="eyebrow">Delivery</p>
                  <h2>Your address book</h2>
                </div>
                <span>{items?.length ?? 0}</span>
              </div>
              {items === null ? (
                <div className="skeleton">Loading addresses…</div>
              ) : items.length === 0 ? (
                <div className="empty-state account-empty compact-empty">
                  <h3>No saved addresses</h3>
                  <p>Add your first delivery address using the form.</p>
                </div>
              ) : (
                <div className="address-cards">
                  {items.map((item) => (
                    <article key={item.id} className={item.isDefault ? 'is-default' : ''}>
                      <div className="address-card-icon" aria-hidden="true">
                        ⌂
                      </div>
                      <div className="address-card-copy">
                        <div className="address-card-title">
                          <h3>{item.label}</h3>
                          {item.isDefault && <span className="status">Default</span>}
                        </div>
                        <address>
                          {item.line1}
                          {item.line2 ? (
                            <>
                              <br />
                              {item.line2}
                            </>
                          ) : null}
                          <br />
                          {item.city}, {item.postcode}
                          <br />
                          United Kingdom
                        </address>
                      </div>
                      <div className="address-card-actions">
                        {!item.isDefault && (
                          <button onClick={() => void makeDefault(item.id)}>Make default</button>
                        )}
                        <button className="danger-link" onClick={() => void remove(item.id)}>
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <form className="form-card address-form" onSubmit={(event) => void create(event)}>
              <div className="address-form-heading">
                <p className="eyebrow">New address</p>
                <h2>Add an address</h2>
                <p>Fields marked with * are required.</p>
              </div>
              <label>
                Address label *<input required name="label" placeholder="e.g. Home or Work" />
              </label>
              <label>
                Address line 1 *<input required name="line1" autoComplete="address-line1" />
              </label>
              <label>
                Address line 2 <span>(optional)</span>
                <input name="line2" autoComplete="address-line2" />
              </label>
              <div className="form-grid">
                <label>
                  Town or city *<input required name="city" autoComplete="address-level2" />
                </label>
                <label>
                  Postcode *<input required name="postcode" autoComplete="postal-code" />
                </label>
              </div>
              <label className="check-row">
                <input type="checkbox" name="isDefault" />
                <span>Use as my default delivery address</span>
              </label>
              <button className="button">Save address</button>
              {message && (
                <p className="form-success" role="status">
                  {message}
                </p>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
