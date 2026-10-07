/* eslint-disable local/no-jsx-literals */
import { saveSettings } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { fetchAdminSettings } from '../lib/api';

export const dynamic = 'force-dynamic';

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
          <p className="eyebrow">Runtime configuration</p>
          <h1>Settings & branding</h1>
          <p>Manage store configuration and company identity.</p>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      {!result.ok ? (
        <ApiNotice message={result.error} />
      ) : (
        <section className="settings-grid">
          <form action={saveSettings} className="panel settings-editor">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Store configuration</p>
                <h2>Business settings</h2>
              </div>
              <span className="count-pill">Version {result.data.settingsVersion}</span>
            </header>
            <div className="editor-body">
              <label className="form-field">
                <span>Settings JSON</span>
                <small>Advanced configuration used by checkout and store operations.</small>
                <textarea
                  name="settings"
                  rows={20}
                  defaultValue={JSON.stringify(result.data.settings, null, 2)}
                  spellCheck={false}
                />
              </label>
            </div>
            <footer className="panel-actions">
              <button className="button button-primary">Save settings</button>
            </footer>
          </form>
          <article className="panel brand-profile">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Company identity</p>
                <h2>Brand profile</h2>
              </div>
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
                  <div>
                    <dt>Legal entity</dt>
                    <dd>{result.data.branding.legalEntityName}</dd>
                  </div>
                  <div>
                    <dt>Company number</dt>
                    <dd>{result.data.branding.companyNumber ?? 'Not set'}</dd>
                  </div>
                  <div>
                    <dt>VAT number</dt>
                    <dd>{result.data.branding.vatNumber ?? 'Not set'}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="panel-empty">No branding profile is configured.</p>
            )}
          </article>
        </section>
      )}
    </>
  );
}
