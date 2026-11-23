/* eslint-disable local/no-jsx-literals */
import {
  saveIntegrations,
  savePaymentSettings,
  saveStoreProfile,
  testPaymentConnection,
} from '../actions';
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function value(source: Record<string, unknown>, key: string, fallback = '') {
  const item = source[key];
  return typeof item === 'string' ? item : fallback;
}

type FooterLink = { label: string; href: string };

function links(value: unknown, fallback: FooterLink[]) {
  if (!Array.isArray(value)) return fallback;
  const parsed = value.flatMap((item) => {
    const link = record(item);
    const label = valueFromUnknown(link.label);
    const href = valueFromUnknown(link.href);
    return label && href ? [{ label, href }] : [];
  });
  return parsed.length ? parsed : fallback;
}

function valueFromUnknown(item: unknown) {
  return typeof item === 'string' ? item : '';
}

const defaultShopLinks: FooterLink[] = [
  { label: 'All Categories', href: '/category/all' },
  { label: 'Groceries', href: '/category/groceries' },
  { label: 'Fresh Food', href: '/category/fresh-food' },
  { label: 'Frozen', href: '/category/frozen' },
  { label: 'Alcohol', href: '/alcohol' },
  { label: 'Offers', href: '/offers' },
];

const defaultServiceLinks: FooterLink[] = [
  { label: 'Contact Us', href: '/help/contact' },
  { label: 'Delivery Information', href: '/help/delivery' },
  { label: 'Returns & Refunds', href: '/legal/returns' },
  { label: 'Terms & Conditions', href: '/legal/terms' },
  { label: 'Privacy Policy', href: '/legal/privacy' },
  { label: 'Responsible Drinking', href: '/help/responsible-drinking' },
];

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
          {(() => {
            const storefront = record(result.data.settings.storefront);
            const seo = record(result.data.settings.seo);
            const footer = record(result.data.settings.footer);
            const social = record(footer.social);
            const shopLinks = links(footer.shopLinks, defaultShopLinks);
            const serviceLinks = links(footer.serviceLinks, defaultServiceLinks);
            const branding = result.data.branding;
            const address = record(branding?.registeredAddress);
            const assets = record(branding?.assets);
            const logoUrl = value(assets, 'logoUrl');
            const storeName = value(
              storefront,
              'storeName',
              branding?.brandName ?? 'Denes Commerce',
            );
            return (
              <form action={saveStoreProfile} className="store-settings-form">
                <input type="hidden" name="currentLogoUrl" value={logoUrl} />
                <input
                  type="hidden"
                  name="colours"
                  value={JSON.stringify(branding?.colours ?? {})}
                />
                <input
                  type="hidden"
                  name="typography"
                  value={JSON.stringify(branding?.typography ?? {})}
                />
                <input
                  type="hidden"
                  name="emailBranding"
                  value={JSON.stringify(branding?.emailBranding ?? {})}
                />

                <section className="panel store-settings-section">
                  <header className="panel-header">
                    <div>
                      <p className="eyebrow">Store identity</p>
                      <h2>Store details</h2>
                      <small>The name and logo customers see across the storefront.</small>
                    </div>
                    <span className="status-badge success">Live store</span>
                  </header>
                  <div className="integration-body store-identity-layout">
                    <div className="store-logo-control">
                      <div className="store-logo-preview">
                        {logoUrl ? (
                          <img src={logoUrl} alt={`${storeName} logo`} />
                        ) : (
                          <span>{storeName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <label className="form-field">
                        <span>Storefront logo</span>
                        <input
                          name="storeLogo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                        />
                        <small>PNG, JPEG, WebP or AVIF. Maximum 10 MB.</small>
                      </label>
                    </div>
                    <div className="form-grid two-column-form">
                      <label className="form-field">
                        <span>Store name</span>
                        <input name="storeName" required defaultValue={storeName} />
                      </label>
                      <label className="form-field">
                        <span>Store tagline</span>
                        <input
                          name="tagline"
                          defaultValue={value(storefront, 'tagline')}
                          placeholder="A little bit of Kerala in every home"
                        />
                      </label>
                      <label className="form-field">
                        <span>Customer support email</span>
                        <input
                          name="supportEmail"
                          type="email"
                          defaultValue={value(storefront, 'supportEmail')}
                          placeholder="support@example.com"
                        />
                      </label>
                      <label className="form-field">
                        <span>Customer support phone</span>
                        <input
                          name="supportPhone"
                          defaultValue={value(storefront, 'supportPhone')}
                          placeholder="+44 20 0000 0000"
                        />
                      </label>
                    </div>
                  </div>
                </section>

                <section className="settings-grid store-settings-grid">
                  <article className="panel store-settings-section">
                    <header className="panel-header">
                      <div>
                        <p className="eyebrow">Search appearance</p>
                        <h2>Homepage SEO</h2>
                        <small>Control how the homepage appears in search results.</small>
                      </div>
                    </header>
                    <div className="integration-body form-grid">
                      <label className="form-field">
                        <span>Homepage title</span>
                        <input
                          name="homepageTitle"
                          required
                          maxLength={70}
                          defaultValue={value(seo, 'homepageTitle', storeName)}
                        />
                        <small>Recommended length: 50–60 characters.</small>
                      </label>
                      <label className="form-field">
                        <span>Homepage meta description</span>
                        <textarea
                          name="homepageMetaDescription"
                          required
                          maxLength={170}
                          rows={4}
                          defaultValue={value(seo, 'homepageMetaDescription')}
                          placeholder="Describe the store for search engines and social sharing."
                        />
                        <small>Recommended length: 140–160 characters.</small>
                      </label>
                    </div>
                  </article>

                  <article className="panel store-settings-section">
                    <header className="panel-header">
                      <div>
                        <p className="eyebrow">Company information</p>
                        <h2>Business details</h2>
                        <small>Used on invoices, customer emails and legal documents.</small>
                      </div>
                    </header>
                    <div className="integration-body form-grid two-column-form">
                      <label className="form-field full-field">
                        <span>Legal business name</span>
                        <input
                          name="legalEntityName"
                          required
                          defaultValue={branding?.legalEntityName ?? storeName}
                        />
                      </label>
                      <label className="form-field">
                        <span>Company number</span>
                        <input name="companyNumber" defaultValue={branding?.companyNumber ?? ''} />
                      </label>
                      <label className="form-field">
                        <span>VAT number</span>
                        <input name="vatNumber" defaultValue={branding?.vatNumber ?? ''} />
                      </label>
                      <label className="form-field full-field">
                        <span>Registered address</span>
                        <input
                          name="addressLine1"
                          required
                          defaultValue={value(address, 'line1')}
                        />
                      </label>
                      <label className="form-field full-field">
                        <span>Address line 2</span>
                        <input name="addressLine2" defaultValue={value(address, 'line2')} />
                      </label>
                      <label className="form-field">
                        <span>Town or city</span>
                        <input name="city" required defaultValue={value(address, 'city')} />
                      </label>
                      <label className="form-field">
                        <span>County</span>
                        <input name="county" defaultValue={value(address, 'county')} />
                      </label>
                      <label className="form-field">
                        <span>Postcode</span>
                        <input name="postcode" required defaultValue={value(address, 'postcode')} />
                      </label>
                      <label className="form-field">
                        <span>Country</span>
                        <input
                          name="country"
                          required
                          defaultValue={value(address, 'country', 'United Kingdom')}
                        />
                      </label>
                    </div>
                  </article>
                </section>

                <section className="panel store-settings-section">
                  <header className="panel-header">
                    <div>
                      <p className="eyebrow">Storefront footer</p>
                      <h2>Footer links & social profiles</h2>
                      <small>
                        Manage footer copy, navigation destinations and social media icons.
                      </small>
                    </div>
                  </header>
                  <div className="integration-body footer-settings-stack">
                    <div className="form-grid two-column-form">
                      <label className="form-field full-field">
                        <span>Footer description</span>
                        <textarea
                          name="footerDescription"
                          rows={3}
                          defaultValue={value(footer, 'description')}
                          placeholder="A short description of the store"
                        />
                      </label>
                      <label className="form-field">
                        <span>Copyright line</span>
                        <input
                          name="footerCopyright"
                          defaultValue={value(footer, 'copyright')}
                          placeholder="© 2026 Angadi. All rights reserved."
                        />
                      </label>
                      <label className="form-field">
                        <span>Footer closing text</span>
                        <input
                          name="footerBottomText"
                          defaultValue={value(footer, 'bottomText')}
                          placeholder="Kerala & Indian groceries delivered across the UK"
                        />
                      </label>
                    </div>

                    <div className="field-divider">
                      <span>Social profiles</span>
                    </div>
                    <div className="form-grid three-column-form">
                      <label className="form-field">
                        <span>Instagram URL</span>
                        <input
                          name="instagramUrl"
                          type="url"
                          defaultValue={value(social, 'instagram')}
                          placeholder="https://instagram.com/..."
                        />
                      </label>
                      <label className="form-field">
                        <span>Facebook URL</span>
                        <input
                          name="facebookUrl"
                          type="url"
                          defaultValue={value(social, 'facebook')}
                          placeholder="https://facebook.com/..."
                        />
                      </label>
                      <label className="form-field">
                        <span>YouTube URL</span>
                        <input
                          name="youtubeUrl"
                          type="url"
                          defaultValue={value(social, 'youtube')}
                          placeholder="https://youtube.com/@..."
                        />
                      </label>
                    </div>

                    <div className="footer-link-columns">
                      <FooterLinkEditor title="Shop links" name="shop" links={shopLinks} />
                      <FooterLinkEditor
                        title="Customer service links"
                        name="service"
                        links={serviceLinks}
                      />
                    </div>
                  </div>
                </section>

                <section className="panel store-settings-section">
                  <header className="panel-header">
                    <div>
                      <p className="eyebrow">Regional standards</p>
                      <h2>Store format</h2>
                      <small>Defaults used for dates, prices and operational timestamps.</small>
                    </div>
                  </header>
                  <div className="integration-body form-grid three-column-form">
                    <label className="form-field">
                      <span>Locale</span>
                      <select name="locale" defaultValue={value(storefront, 'locale', 'en-GB')}>
                        <option value="en-GB">English (United Kingdom)</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Currency</span>
                      <select name="currency" defaultValue={value(storefront, 'currency', 'GBP')}>
                        <option value="GBP">GBP — British Pound</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Timezone</span>
                      <select
                        name="timezone"
                        defaultValue={value(storefront, 'timezone', 'Europe/London')}
                      >
                        <option value="Europe/London">Europe/London</option>
                      </select>
                    </label>
                  </div>
                  <footer className="panel-actions">
                    <span className="settings-version">
                      Configuration version {result.data.settingsVersion}
                    </span>
                    <button className="button button-primary">Save store settings</button>
                  </footer>
                </section>
              </form>
            );
          })()}

          <section className="panel payment-settings-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Payment integration</p>
                <h2>Stripe</h2>
                <small>Configure card payments for the website and mobile application.</small>
              </div>
              <span
                className={`status-badge ${result.data.integrations.payment.enabled ? 'success' : ''}`}
              >
                {result.data.integrations.payment.enabled
                  ? `${result.data.integrations.payment.mode} mode`
                  : 'Disabled'}
              </span>
            </header>
            <form action={savePaymentSettings}>
              <div className="integration-body form-grid two-column-form">
                <label className="switch-field full-field">
                  <input
                    name="paymentEnabled"
                    type="checkbox"
                    defaultChecked={result.data.integrations.payment.enabled}
                  />
                  <span>
                    <strong>Enable Stripe checkout</strong>
                    <small>
                      Customers can pay by card when all three credentials are configured.
                    </small>
                  </span>
                </label>
                <label className="form-field full-field">
                  <span>Publishable key</span>
                  <input
                    name="publishableKey"
                    defaultValue={result.data.integrations.payment.publishableKey}
                    placeholder="pk_test_..."
                    autoComplete="off"
                  />
                  <small>This key is safe to expose to the checkout client.</small>
                </label>
                <label className="form-field">
                  <span>Secret key</span>
                  <input
                    name="secretKey"
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      result.data.integrations.payment.secretKeyConfigured
                        ? 'sk_••••••••••••'
                        : 'sk_test_...'
                    }
                  />
                  <SecretHint configured={result.data.integrations.payment.secretKeyConfigured} />
                </label>
                <label className="form-field">
                  <span>Webhook signing secret</span>
                  <input
                    name="webhookSecret"
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      result.data.integrations.payment.webhookSecretConfigured
                        ? 'whsec_••••••••••••'
                        : 'whsec_...'
                    }
                  />
                  <SecretHint
                    configured={result.data.integrations.payment.webhookSecretConfigured}
                  />
                </label>
                <div className="full-field payment-webhook-note">
                  <strong>Webhook endpoint</strong>
                  <code>/api/v1/webhooks/stripe</code>
                  <small>
                    Add this endpoint in Stripe and subscribe to PaymentIntent payment events.
                  </small>
                </div>
              </div>
              <footer className="panel-actions">
                <button className="button button-primary">Save payment settings</button>
              </footer>
            </form>
            <form action={testPaymentConnection} className="payment-connection-test">
              <button className="button button-secondary">Test saved Stripe connection</button>
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
                    <select
                      name="emailProvider"
                      defaultValue={result.data.integrations.email.provider}
                    >
                      <option value="SMTP">SMTP server</option>
                      <option value="RESEND">Resend API</option>
                      <option value="LOG">Disabled / development log</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Sender name</span>
                    <input
                      name="fromName"
                      required
                      defaultValue={result.data.integrations.email.fromName}
                    />
                  </label>
                  <label className="form-field">
                    <span>Sender email</span>
                    <input
                      name="fromEmail"
                      type="email"
                      required
                      defaultValue={result.data.integrations.email.fromEmail}
                      placeholder="orders@example.com"
                    />
                  </label>
                  <label className="form-field full-field">
                    <span>Reply-to email</span>
                    <input
                      name="replyTo"
                      type="email"
                      defaultValue={result.data.integrations.email.replyTo}
                      placeholder="support@example.com"
                    />
                  </label>
                  <div className="field-divider full-field">
                    <span>SMTP credentials</span>
                  </div>
                  <label className="form-field">
                    <span>SMTP host</span>
                    <input
                      name="smtpHost"
                      defaultValue={result.data.integrations.email.smtpHost}
                      placeholder="smtp.example.com"
                    />
                  </label>
                  <label className="form-field">
                    <span>Port</span>
                    <input
                      name="smtpPort"
                      type="number"
                      min="1"
                      max="65535"
                      defaultValue={result.data.integrations.email.smtpPort}
                    />
                  </label>
                  <label className="form-field">
                    <span>Username</span>
                    <input
                      name="smtpUsername"
                      autoComplete="off"
                      defaultValue={result.data.integrations.email.smtpUsername}
                    />
                  </label>
                  <label className="form-field">
                    <span>Password</span>
                    <input
                      name="smtpPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder={
                        result.data.integrations.email.smtpPasswordConfigured
                          ? '••••••••••••'
                          : 'Enter SMTP password'
                      }
                    />
                    <SecretHint
                      configured={result.data.integrations.email.smtpPasswordConfigured}
                    />
                  </label>
                  <label className="switch-field full-field">
                    <input
                      name="smtpSecure"
                      type="checkbox"
                      defaultChecked={result.data.integrations.email.smtpSecure}
                    />
                    <span>
                      <strong>Use secure TLS connection</strong>
                      <small>
                        Enable for port 465. STARTTLS is used automatically on port 587.
                      </small>
                    </span>
                  </label>
                  <div className="field-divider full-field">
                    <span>Resend credentials</span>
                  </div>
                  <label className="form-field full-field">
                    <span>Resend API key</span>
                    <input
                      name="resendApiKey"
                      type="password"
                      autoComplete="new-password"
                      placeholder={
                        result.data.integrations.email.resendApiKeyConfigured
                          ? 're_••••••••••••'
                          : 're_...'
                      }
                    />
                    <SecretHint
                      configured={result.data.integrations.email.resendApiKeyConfigured}
                    />
                  </label>
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
                    <div className="provider-title">
                      <span className="provider-mark google-mark">G</span>
                      <div>
                        <strong>Google</strong>
                        <small>OAuth 2.0 customer sign-in</small>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          name="googleEnabled"
                          defaultChecked={result.data.integrations.socialLogin.googleEnabled}
                        />
                        <span />
                      </label>
                    </div>
                    <label className="form-field">
                      <span>Client ID</span>
                      <input
                        name="googleClientId"
                        defaultValue={result.data.integrations.socialLogin.googleClientId}
                        placeholder="...apps.googleusercontent.com"
                      />
                    </label>
                    <label className="form-field">
                      <span>Client secret</span>
                      <input
                        name="googleClientSecret"
                        type="password"
                        autoComplete="new-password"
                        placeholder={
                          result.data.integrations.socialLogin.googleClientSecretConfigured
                            ? '••••••••••••'
                            : 'Enter client secret'
                        }
                      />
                      <SecretHint
                        configured={
                          result.data.integrations.socialLogin.googleClientSecretConfigured
                        }
                      />
                    </label>
                  </section>
                  <section className="provider-section">
                    <div className="provider-title">
                      <span className="provider-mark apple-mark">A</span>
                      <div>
                        <strong>Apple</strong>
                        <small>Sign in with Apple</small>
                      </div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          name="appleEnabled"
                          defaultChecked={result.data.integrations.socialLogin.appleEnabled}
                        />
                        <span />
                      </label>
                    </div>
                    <label className="form-field">
                      <span>Services ID / Client ID</span>
                      <input
                        name="appleClientId"
                        defaultValue={result.data.integrations.socialLogin.appleClientId}
                      />
                    </label>
                    <div className="form-grid two-column-form">
                      <label className="form-field">
                        <span>Team ID</span>
                        <input
                          name="appleTeamId"
                          defaultValue={result.data.integrations.socialLogin.appleTeamId}
                        />
                      </label>
                      <label className="form-field">
                        <span>Key ID</span>
                        <input
                          name="appleKeyId"
                          defaultValue={result.data.integrations.socialLogin.appleKeyId}
                        />
                      </label>
                    </div>
                    <label className="form-field">
                      <span>Private key</span>
                      <textarea
                        name="applePrivateKey"
                        rows={4}
                        placeholder={
                          result.data.integrations.socialLogin.applePrivateKeyConfigured
                            ? 'Private key configured — leave blank to keep it'
                            : '-----BEGIN PRIVATE KEY-----'
                        }
                      />
                      <SecretHint
                        configured={result.data.integrations.socialLogin.applePrivateKeyConfigured}
                      />
                    </label>
                  </section>
                </div>
              </article>
            </section>
            <div className="sticky-save-bar">
              <div>
                <strong>Communication & sign-in</strong>
                <small>
                  Secrets are encrypted before storage and are never returned to the browser.
                </small>
              </div>
              <button className="button button-primary">Save integration settings</button>
            </div>
          </form>
        </>
      )}
    </>
  );
}

function FooterLinkEditor({
  title,
  name,
  links,
}: {
  title: string;
  name: 'shop' | 'service';
  links: FooterLink[];
}) {
  return (
    <fieldset className="footer-link-editor">
      <legend>{title}</legend>
      {Array.from({ length: 6 }, (_, index) => {
        const link = links[index];
        return (
          <div className="footer-link-row" key={`${name}-${String(index)}`}>
            <label className="form-field">
              <span>Label {String(index + 1)}</span>
              <input
                name={`${name}LinkLabel${String(index)}`}
                defaultValue={link?.label ?? ''}
                placeholder="Link label"
              />
            </label>
            <label className="form-field">
              <span>Destination</span>
              <input
                name={`${name}LinkHref${String(index)}`}
                defaultValue={link?.href ?? ''}
                placeholder="/page or https://..."
              />
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
