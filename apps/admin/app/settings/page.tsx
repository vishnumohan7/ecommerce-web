/* eslint-disable local/no-jsx-literals */
import { saveIntegrations, saveSettings } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { fetchAdminSettings } from '../lib/api';

export const dynamic = 'force-dynamic';

function SecretHint({ configured }: { configured: boolean }) {
  return (
    <small className={configured ? 'secret-configured' : undefined}>
      {configured ? 'Configured — leave blank to keep the saved secret.' : 'Not configured.'}
    </small>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [params, result] = await Promise.all([searchParams, fetchAdminSettings()]);
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Store configuration</p>
          <h1>Settings & branding</h1>
          <p>Manage company identity, customer email and sign-in providers for this store.</p>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      {!result.ok ? (
        <ApiNotice message={result.error} />
      ) : (
        <>
          <section className="settings-grid settings-summary-grid">
            <article className="panel brand-profile">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Company identity</p>
                  <h2>Brand profile</h2>
                </div>
                <span className="status-badge success">Single store</span>
              </header>
              {result.data.branding ? (
                <>
                  <div className="brand-identity">
                    <span className="brand-profile-mark">
                      {result.data.branding.brandName.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{result.data.branding.brandName}</strong>
                      <small>{result.data.branding.legalEntityName}</small>
                    </div>
                  </div>
                  <dl className="detail-list">
                    <div><dt>Legal entity</dt><dd>{result.data.branding.legalEntityName}</dd></div>
                    <div><dt>Company number</dt><dd>{result.data.branding.companyNumber ?? 'Not set'}</dd></div>
                    <div><dt>VAT number</dt><dd>{result.data.branding.vatNumber ?? 'Not set'}</dd></div>
                  </dl>
                </>
              ) : (
                <p className="panel-empty">No branding profile is configured.</p>
              )}
            </article>
            <form action={saveSettings} className="panel settings-editor compact-settings-editor">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Advanced</p>
                  <h2>Business rules</h2>
                </div>
                <span className="count-pill">Version {result.data.settingsVersion}</span>
              </header>
              <div className="editor-body">
                <label className="form-field">
                  <span>Configuration JSON</span>
                  <small>Checkout, pricing and operational rules. Integration secrets are stored separately.</small>
                  <textarea name="settings" rows={10} defaultValue={JSON.stringify(result.data.settings, null, 2)} spellCheck={false} />
                </label>
              </div>
              <footer className="panel-actions"><button className="button button-secondary">Save business rules</button></footer>
            </form>
          </section>

          <form action={saveIntegrations} className="integration-form">
            <section className="integration-grid">
              <article className="panel integration-card">
                <header className="panel-header">
                  <div>
                    <p className="eyebrow">Transactional email</p>
                    <h2>Mail delivery</h2>
                    <small>Order confirmations and invoice attachments use this provider.</small>
                  </div>
                </header>
                <div className="integration-body form-grid two-column-form">
                  <label className="form-field full-field">
                    <span>Delivery provider</span>
                    <select name="emailProvider" defaultValue={result.data.integrations.email.provider}>
                      <option value="SMTP">SMTP server</option>
                      <option value="RESEND">Resend API</option>
                      <option value="LOG">Disabled / development log</option>
                    </select>
                  </label>
                  <label className="form-field"><span>Sender name</span><input name="fromName" required defaultValue={result.data.integrations.email.fromName} /></label>
                  <label className="form-field"><span>Sender email</span><input name="fromEmail" type="email" required defaultValue={result.data.integrations.email.fromEmail} placeholder="orders@example.com" /></label>
                  <label className="form-field full-field"><span>Reply-to email</span><input name="replyTo" type="email" defaultValue={result.data.integrations.email.replyTo} placeholder="support@example.com" /></label>
                  <div className="field-divider full-field"><span>SMTP credentials</span></div>
                  <label className="form-field"><span>SMTP host</span><input name="smtpHost" defaultValue={result.data.integrations.email.smtpHost} placeholder="smtp.example.com" /></label>
                  <label className="form-field"><span>Port</span><input name="smtpPort" type="number" min="1" max="65535" defaultValue={result.data.integrations.email.smtpPort} /></label>
                  <label className="form-field"><span>Username</span><input name="smtpUsername" autoComplete="off" defaultValue={result.data.integrations.email.smtpUsername} /></label>
                  <label className="form-field"><span>Password</span><input name="smtpPassword" type="password" autoComplete="new-password" placeholder={result.data.integrations.email.smtpPasswordConfigured ? '••••••••••••' : 'Enter SMTP password'} /><SecretHint configured={result.data.integrations.email.smtpPasswordConfigured} /></label>
                  <label className="switch-field full-field"><input name="smtpSecure" type="checkbox" defaultChecked={result.data.integrations.email.smtpSecure} /><span><strong>Use secure TLS connection</strong><small>Enable for port 465. STARTTLS is used automatically on port 587.</small></span></label>
                  <div className="field-divider full-field"><span>Resend credentials</span></div>
                  <label className="form-field full-field"><span>Resend API key</span><input name="resendApiKey" type="password" autoComplete="new-password" placeholder={result.data.integrations.email.resendApiKeyConfigured ? 're_••••••••••••' : 're_...'} /><SecretHint configured={result.data.integrations.email.resendApiKeyConfigured} /></label>
                </div>
              </article>

              <article className="panel integration-card">
                <header className="panel-header">
                  <div>
                    <p className="eyebrow">Customer authentication</p>
                    <h2>Social sign-in</h2>
                    <small>Credentials for the customer website and mobile application.</small>
                  </div>
                </header>
                <div className="integration-body social-provider-stack">
                  <section className="provider-section">
                    <div className="provider-title"><span className="provider-mark google-mark">G</span><div><strong>Google</strong><small>OAuth 2.0 customer sign-in</small></div><label className="toggle"><input type="checkbox" name="googleEnabled" defaultChecked={result.data.integrations.socialLogin.googleEnabled} /><span /></label></div>
                    <label className="form-field"><span>Client ID</span><input name="googleClientId" defaultValue={result.data.integrations.socialLogin.googleClientId} placeholder="...apps.googleusercontent.com" /></label>
                    <label className="form-field"><span>Client secret</span><input name="googleClientSecret" type="password" autoComplete="new-password" placeholder={result.data.integrations.socialLogin.googleClientSecretConfigured ? '••••••••••••' : 'Enter client secret'} /><SecretHint configured={result.data.integrations.socialLogin.googleClientSecretConfigured} /></label>
                  </section>
                  <section className="provider-section">
                    <div className="provider-title"><span className="provider-mark apple-mark">A</span><div><strong>Apple</strong><small>Sign in with Apple</small></div><label className="toggle"><input type="checkbox" name="appleEnabled" defaultChecked={result.data.integrations.socialLogin.appleEnabled} /><span /></label></div>
                    <label className="form-field"><span>Services ID / Client ID</span><input name="appleClientId" defaultValue={result.data.integrations.socialLogin.appleClientId} /></label>
                    <div className="form-grid two-column-form"><label className="form-field"><span>Team ID</span><input name="appleTeamId" defaultValue={result.data.integrations.socialLogin.appleTeamId} /></label><label className="form-field"><span>Key ID</span><input name="appleKeyId" defaultValue={result.data.integrations.socialLogin.appleKeyId} /></label></div>
                    <label className="form-field"><span>Private key</span><textarea name="applePrivateKey" rows={4} placeholder={result.data.integrations.socialLogin.applePrivateKeyConfigured ? 'Private key configured — leave blank to keep it' : '-----BEGIN PRIVATE KEY-----'} /><SecretHint configured={result.data.integrations.socialLogin.applePrivateKeyConfigured} /></label>
                  </section>
                </div>
              </article>
            </section>
            <div className="sticky-save-bar"><div><strong>Communication & sign-in</strong><small>Secrets are encrypted before storage and are never returned to the browser.</small></div><button className="button button-primary">Save integration settings</button></div>
          </form>
        </>
      )}
    </>
  );
}
