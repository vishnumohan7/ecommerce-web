'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { browserApi } from '../lib/store-api';

export function VerifyEmail({ token }: Readonly<{ token: string }>) {
  const [state, setState] = useState<'working' | 'verified' | 'failed'>(
    token ? 'working' : 'failed',
  );
  const [message, setMessage] = useState(
    token ? 'Verifying your email address…' : 'This verification link is incomplete.',
  );

  useEffect(() => {
    if (!token) return;
    void browserApi('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(() => {
        setState('verified');
        setMessage('Your email address is verified. You can now sign in.');
      })
      .catch((error: unknown) => {
        setState('failed');
        setMessage(
          error instanceof Error ? error.message : 'This verification link is invalid or expired.',
        );
      });
  }, [token]);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '');
    setMessage('Requesting a fresh verification link…');
    try {
      await browserApi('/api/v1/auth/verify-email/resend', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage('If the account still needs verification, a fresh link has been sent.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The verification email could not be requested.',
      );
    }
  }

  return (
    <main className="section auth-shell">
      <section className="form-card auth-card" aria-live="polite">
        <p className="eyebrow">Account verification</p>
        <h1>{state === 'verified' ? 'Email verified' : 'Verify your email'}</h1>
        <p className="form-message" role="status">
          {message}
        </p>
        {state === 'verified' ? (
          <Link className="button full" href="/auth/login">
            Continue to sign in
          </Link>
        ) : state === 'failed' ? (
          <form onSubmit={resend}>
            <label>
              Email address
              <input required type="email" name="email" autoComplete="email" />
            </label>
            <button className="button full" type="submit">
              Resend verification email
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
