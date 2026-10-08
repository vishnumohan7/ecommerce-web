'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserApi } from '../lib/store-api';

type Mode = 'login' | 'register' | 'otp' | 'forgot' | 'reset';
export function AuthForm({ mode }: Readonly<{ mode: Mode }>) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [challengeId, setChallengeId] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('Working…');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === 'otp' && !challengeId) {
        const data = await browserApi<{ challengeId: string }>('/api/v1/auth/otp/request', {
          method: 'POST',
          body: JSON.stringify({ phone: values.phone }),
        });
        setChallengeId(data.challengeId);
        setMessage('Code sent.');
        return;
      }
      const endpoint =
        mode === 'login'
          ? 'login'
          : mode === 'register'
            ? 'register'
            : mode === 'otp'
              ? 'otp/verify'
              : mode === 'forgot'
                ? 'password/forgot'
                : 'password/reset';
      const body = mode === 'otp' ? { challengeId, code: values.code } : values;
      const data = await browserApi<{
        authenticated?: boolean;
        accepted?: boolean;
      }>(`/api/v1/auth/${endpoint}`, { method: 'POST', body: JSON.stringify(body) });
      if (data.authenticated) {
        router.push('/profile');
      } else if (mode === 'register') {
        setMessage('Account created. We sent a verification link to your email address.');
      } else if (mode === 'forgot')
        setMessage('If that account exists, reset instructions have been sent.');
      else {
        setMessage('Password updated. You can now sign in.');
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Request failed');
    }
  }
  const title = {
    login: 'Sign in',
    register: 'Create an account',
    otp: 'Sign in with a code',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  }[mode];
  return (
    <main className="section auth-shell">
      <form className="form-card auth-card" onSubmit={submit}>
        <p className="eyebrow">Your Denes account</p>
        <h1>{title}</h1>
        {mode === 'register' && (
          <div className="form-grid">
            <label>
              First name
              <input required name="firstName" />
            </label>
            <label>
              Last name
              <input required name="lastName" />
            </label>
          </div>
        )}
        {['login', 'register', 'forgot'].includes(mode) && (
          <label>
            Email address
            <input required type="email" name="email" autoComplete="email" />
          </label>
        )}
        {['login', 'register', 'reset'].includes(mode) && (
          <label>
            {mode === 'reset' ? 'New password' : 'Password'}
            <input
              required
              type="password"
              name="password"
              minLength={12}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
        )}
        {mode === 'otp' && (
          <>
            {!challengeId ? (
              <label>
                Mobile number
                <input required type="tel" name="phone" autoComplete="tel" />
              </label>
            ) : (
              <label>
                Verification code
                <input required name="code" inputMode="numeric" autoComplete="one-time-code" />
              </label>
            )}
          </>
        )}
        {mode === 'reset' && (
          <label>
            Reset token
            <input
              required
              name="token"
              defaultValue={
                typeof window !== 'undefined'
                  ? (new URLSearchParams(window.location.search).get('token') ?? '')
                  : ''
              }
            />
          </label>
        )}
        <button className="button full">
          {mode === 'otp' && !challengeId ? 'Send code' : title}
        </button>
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
        {mode === 'login' && (
          <div className="auth-links">
            <Link href="/auth/forgot-password">Forgot password?</Link>
            <Link href="/auth/otp">Use a one-time code</Link>
            <Link href="/auth/register">Create account</Link>
          </div>
        )}
      </form>
    </main>
  );
}
