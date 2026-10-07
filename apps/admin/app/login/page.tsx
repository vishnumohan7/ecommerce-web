/* eslint-disable local/no-jsx-literals -- Admin login is English-only. */
import { adminLogin } from '../auth-actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="login-page">
    <section className="login-showcase">
      <div className="showcase-brand"><span>D</span><strong>DENES</strong><small>COMMERCE</small></div>
      <div className="showcase-copy"><p>COMMERCE OPERATIONS</p><h1>One workspace.<br/>Every operation.</h1><span>Manage catalogue, inventory, orders, fulfilment and compliance from a single secure console.</span><div className="showcase-capabilities"><b>Catalogue</b><b>Orders</b><b>Inventory</b><b>Compliance</b></div></div>
      <div className="showcase-grid" aria-hidden="true"><div/><div/><div/><div/><div/><div/></div>
      <p className="showcase-foot">Secure staff access · United Kingdom</p>
    </section>
    <section className="login-form-side">
      <div className="login-mobile-brand"><span>D</span><strong>DENES</strong></div>
      <form action={adminLogin} className="login-card">
        <div className="login-heading"><span className="login-lock" aria-hidden="true">✓</span><p>STAFF PORTAL</p><h2>Welcome back</h2><span>Sign in with your authorised administrator account.</span></div>
        {error && <p className="action-message is-error">{error}</p>}
        <label>Email address<div className="login-input"><span aria-hidden="true">@</span><input type="email" name="email" autoComplete="username" placeholder="name@denes.co.uk" required/></div></label>
        <label>Password<div className="login-input"><span aria-hidden="true">●</span><input type="password" name="password" autoComplete="current-password" placeholder="Enter your password" required/></div></label>
        <div className="login-meta"><label><input type="checkbox" name="remember"/>Keep me signed in</label><span>Protected access</span></div>
        <button className="login-submit" type="submit"><span>Sign in to dashboard</span><b aria-hidden="true">→</b></button>
        <p className="login-security"><span aria-hidden="true">◆</span>Your session is encrypted and permission controlled.</p>
      </form>
      <p className="login-help">Need access? Contact your platform administrator.</p>
    </section>
  </main>;
}
