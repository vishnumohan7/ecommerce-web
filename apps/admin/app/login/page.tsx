/* eslint-disable local/no-jsx-literals -- Admin login is English-only. */
import { adminLogin } from '../auth-actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="login-shell"><form action={adminLogin} className="panel login-card"><p className="eyebrow">Denes Commerce</p><h1>Admin sign in</h1><p>Use an authorised staff account. Access is permission-enforced by the API.</p>{error && <p className="action-message error">{error}</p>}<label>Email<input type="email" name="email" autoComplete="username" required /></label><label>Password<input type="password" name="password" autoComplete="current-password" required /></label><button className="button button-primary" type="submit">Sign in securely</button></form></main>;
}
