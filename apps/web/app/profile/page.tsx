'use client';
/* eslint-disable local/no-jsx-literals -- Storefront account copy is currently English-only. */
import Link from 'next/link';
import { SyntheticEvent, useEffect, useState } from 'react';
import { browserApi } from '../../lib/store-api';
import { AccountSidebar } from '../components/account-sidebar';
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
    <main className="account-page">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <strong>Account settings</strong>
      </div>
      <section className="account-welcome">
        <p className="eyebrow">My account</p>
        <h1>{profile ? `Namaskaram, ${profile.firstName}` : 'Namaskaram'}</h1>
        <p>Manage your profile and the contact details used for orders and delivery.</p>
      </section>
      <div className="account-dashboard">
        <AccountSidebar active="profile" />
        <section className="account-main">
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
                  <p className="eyebrow">Account settings</p>
                  <h2>Profile details</h2>
                  <p>Update your contact information below.</p>
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
              <div className="profile-security-row">
                <div>
                  <strong>Account access</strong>
                  <p>Sign out securely when using a shared device.</p>
                </div>
                <button className="button secondary" type="button" onClick={() => void logout()}>
                  Sign out
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
