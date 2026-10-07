/* eslint-disable local/no-jsx-literals */
import { validateLicense } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { fetchLicense } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function LicensePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [params, result] = await Promise.all([searchParams, fetchLicense()]);
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Commercial licence</p>
          <h1>Licence & entitlements</h1>
          <p>Review your current licence and install a signed replacement.</p>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      {!result.ok ? (
        <ApiNotice message={result.error} />
      ) : (
        <section className="licence-grid">
          <article className="panel licence-status-card">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Subscription status</p>
                <h2>Current licence</h2>
              </div>
              <span
                className={`status-badge ${result.data.license.valid ? 'status-active' : 'status-down'}`}
              >
                {result.data.license.valid ? 'Active' : 'Not active'}
              </span>
            </header>
            <div className="licence-overview">
              <span
                className={`licence-shield ${result.data.license.valid ? 'valid' : ''}`}
                aria-hidden="true"
              >
                ✓
              </span>
              <div>
                <strong>
                  {result.data.license.valid ? 'Licence verified' : 'No active licence'}
                </strong>
                <p>
                  {result.data.license.features.length} licensed feature
                  {result.data.license.features.length === 1 ? '' : 's'} available
                </p>
              </div>
            </div>
            <div className="entitlement-list">
              {result.data.featureFlags.length > 0 ? (
                result.data.featureFlags.map((flag) => (
                  <div key={flag.key}>
                    <span>
                      <strong>{flag.key}</strong>
                      <small>Feature entitlement</small>
                    </span>
                    <span
                      className={`status-badge ${flag.override === false ? 'status-down' : 'status-active'}`}
                    >
                      {flag.override === false ? 'Disabled' : 'Enabled'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="panel-empty">No feature entitlements are active.</p>
              )}
            </div>
          </article>
          <form action={validateLicense} className="panel licence-install-card">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Activation</p>
                <h2>Install licence</h2>
              </div>
            </header>
            <div className="licence-form-body">
              <label className="form-field">
                <span>Signed licence token</span>
                <small>Paste the complete token supplied by your platform administrator.</small>
                <textarea
                  name="token"
                  rows={12}
                  placeholder="Paste signed licence token"
                  required
                />
              </label>
              <div className="secure-note">
                <span aria-hidden="true">✓</span>
                <p>
                  <strong>Verified locally</strong>
                  <small>The signature is checked before the licence is installed.</small>
                </p>
              </div>
            </div>
            <footer className="panel-actions">
              <button className="button button-primary">Validate and install</button>
            </footer>
          </form>
        </section>
      )}
    </>
  );
}
