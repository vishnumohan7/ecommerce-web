/* eslint-disable local/no-jsx-literals -- Admin authentication copy is English-only. */
import { adminResetPassword } from '../auth-actions';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token = '', error } = await searchParams;
  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="showcase-brand">
          <span>D</span>
          <strong>DENES</strong>
          <small>COMMERCE</small>
        </div>
        <div className="showcase-copy">
          <p>SECURE STAFF ACCESS</p>
          <h1>
            Choose a new
            <br />
            password.
          </h1>
          <span>This link is single-use and expires after 30 minutes.</span>
        </div>
        <p className="showcase-foot">Authorised staff accounts only · United Kingdom</p>
      </section>
      <section className="login-form-side">
        <form action={adminResetPassword} className="login-card">
          <div className="login-heading">
            <span className="login-lock" aria-hidden="true">
              ✓
            </span>
            <p>STAFF PORTAL</p>
            <h2>Reset password</h2>
            <span>Enter a strong password for your admin account.</span>
          </div>
          {error && <p className="action-message is-error">{error}</p>}
          {!token && <p className="action-message is-error">The reset token is missing.</p>}
          <input type="hidden" name="token" value={token} />
          <label>
            New password
            <div className="login-input">
              <span aria-hidden="true">●</span>
              <input
                type="password"
                name="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </div>
          </label>
          <button className="login-submit" type="submit" disabled={!token}>
            Update password
          </button>
        </form>
      </section>
    </main>
  );
}
