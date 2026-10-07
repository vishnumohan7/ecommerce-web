'use client';

import { useFormStatus } from 'react-dom';

export function LoginSubmitButton() {
  const { pending } = useFormStatus();
  return <button className="login-submit" type="submit" disabled={pending} aria-busy={pending}>
    <span>{pending ? 'Signing in…' : 'Sign in to dashboard'}</span>
    <b aria-hidden="true">{pending ? '•••' : '→'}</b>
  </button>;
}
