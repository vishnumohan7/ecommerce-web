'use client';
/* eslint-disable local/no-jsx-literals -- Storefront account copy is currently English-only. */
import Link from 'next/link';
import { SyntheticEvent, useEffect, useState } from 'react';
import { browserApi } from '../../lib/store-api';
interface ProfileData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
}
export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    void browserApi<ProfileData>('/api/v1/profile')
      .then(setProfile)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not load profile');
      });
  }, []);
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('Saving…');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const updated = await browserApi<ProfileData>('/api/v1/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone || null,
        }),
      });
      setProfile(updated);
      setMessage('Profile saved.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Could not save');
    }
  }
  async function logout() {
    await browserApi('/api/v1/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined);
    location.href = '/';
  }
  if (error)
    return (
      <main className="section">
        <div className="empty-state">
          <h1>My account</h1>
          <p>{error}</p>
          <Link className="button" href="/auth/login">
            Sign in
          </Link>
        </div>
      </main>
    );
  return (
    <main className="account-page account-page-narrow">
      <header className="account-page-header">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>Profile settings</h1>
          <p>Keep your contact information up to date for order notifications and delivery.</p>
        </div>
      </header>
      {!profile ? (
        <div className="skeleton">Loading account…</div>
      ) : (
        <form className="form-card profile-form" onSubmit={(event) => void save(event)}>
          <div className="profile-form-heading">
            <span aria-hidden="true">
              {profile.firstName.slice(0, 1)}
              {profile.lastName.slice(0, 1)}
            </span>
            <div>
              <h2>
                {profile.firstName} {profile.lastName}
              </h2>
              <p>Customer account</p>
            </div>
          </div>
          <label>
            Email address
            <input disabled value={profile.email} />
          </label>
          <div className="form-grid">
            <label>
              First name
              <input required name="firstName" defaultValue={profile.firstName} />
            </label>
            <label>
              Last name
              <input required name="lastName" defaultValue={profile.lastName} />
            </label>
          </div>
          <label>
            Phone
            <input name="phone" type="tel" defaultValue={profile.phone ?? ''} />
          </label>
          <div className="profile-save-row">
            <button className="button">Save changes</button>
            {message && (
              <p className="form-success" role="status">
                {message}
              </p>
            )}
          </div>
          <hr />
          <p className="account-links-label">Manage your account</p>
          <div className="account-links">
            <Link href="/orders">Orders</Link>
            <Link href="/addresses">Addresses</Link>
            <Link href="/wishlist">Wishlist</Link>
            <Link href="/privacy">Privacy</Link>
            <button type="button" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
