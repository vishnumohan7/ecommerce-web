/* eslint-disable local/no-jsx-literals */
import {
  deleteBanner,
  deleteContentBlock,
  saveCmsPage,
  toggleBanner,
  toggleContentBlock,
} from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { BannerUploadForm } from '../components/banner-upload-form';
import { fetchContent } from '../lib/api';
export const dynamic = 'force-dynamic';
export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [query, result] = await Promise.all([searchParams, fetchContent()]);
  const promoCards = result.ok
    ? result.data.blocks.filter((block) => block.type === 'PROMO_BLOCK')
    : [];
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Storefront publishing</p>
          <h1>Banners & CMS</h1>
          <p>
            Create scheduled homepage merchandising and publish the store’s legal and policy pages.
          </p>
        </div>
      </section>
      <ActionMessage success={query.success} error={query.error} />
      {!result.ok ? (
        <ApiNotice message={result.error} />
      ) : (
        <>
          <section className="admin-grid">
            <article className="panel slider-management-panel">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Homepage slider</p>
                  <h2>Slides</h2>
                  <p>Upload, schedule and order the banners shown on the storefront homepage.</p>
                </div>
                <span className="count-pill">{result.data.banners.length}</span>
              </header>
              <BannerUploadForm className="content-form">
                <input type="hidden" name="intent" value="create" />
                <input name="title" placeholder="Slide heading" required />
                <input name="subtitle" placeholder="Supporting text" />
                <label className="wide-field">
                  Desktop banner image
                  <input
                    name="desktopImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    required
                  />
                </label>
                <label className="wide-field">
                  Mobile banner image (optional)
                  <input
                    name="mobileImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                  />
                </label>
                <input name="linkUrl" type="url" placeholder="Button destination URL" />
                <input name="position" type="number" min="0" defaultValue="0" />
                <label>
                  Starts
                  <input name="startsAt" type="datetime-local" />
                </label>
                <label>
                  Ends
                  <input name="endsAt" type="datetime-local" />
                </label>
                <button className="button button-primary">Add slide</button>
              </BannerUploadForm>
              <div className="table-wrap banner-table-wrap">
                <table className="banner-management-table">
                  <thead>
                    <tr>
                      <th>Preview</th>
                      <th>Slide</th>
                      <th>Schedule</th>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.banners.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <img className="banner-thumbnail" src={item.imageUrl} alt="" />
                        </td>
                        <td>
                          <strong>{item.title}</strong>
                          <small className="cell-subtext">
                            {item.subtitle ?? 'No supporting text'}
                          </small>
                        </td>
                        <td>{formatSchedule(item.startsAt, item.endsAt)}</td>
                        <td>{item.position}</td>
                        <td>
                          <span
                            className={`status-badge ${item.active ? 'status-active' : 'status-down'}`}
                          >
                            <span />
                            {item.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="banner-actions">
                          <details className="row-editor">
                            <summary className="banner-action-button">Edit</summary>
                            <BannerUploadForm>
                              <input type="hidden" name="intent" value="update" />
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="currentImageUrl" value={item.imageUrl} />
                              <input
                                type="hidden"
                                name="currentMobileImageUrl"
                                value={item.mobileImageUrl ?? ''}
                              />
                              <input
                                name="title"
                                defaultValue={item.title}
                                aria-label="Slide heading"
                                required
                              />
                              <input
                                name="subtitle"
                                defaultValue={item.subtitle ?? ''}
                                placeholder="Supporting text"
                              />
                              <input
                                name="linkUrl"
                                type="url"
                                defaultValue={item.linkUrl ?? ''}
                                placeholder="Button destination URL"
                              />
                              <input
                                name="position"
                                type="number"
                                min="0"
                                defaultValue={item.position}
                                aria-label="Display order"
                              />
                              <label>
                                Starts
                                <input
                                  name="startsAt"
                                  type="datetime-local"
                                  defaultValue={dateTimeInput(item.startsAt)}
                                />
                              </label>
                              <label>
                                Ends
                                <input
                                  name="endsAt"
                                  type="datetime-local"
                                  defaultValue={dateTimeInput(item.endsAt)}
                                />
                              </label>
                              <label className="wide-field">
                                Replace desktop image
                                <input
                                  name="desktopImage"
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/avif"
                                />
                              </label>
                              <label className="wide-field">
                                Replace mobile image
                                <input
                                  name="mobileImage"
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/avif"
                                />
                                <small>
                                  {item.mobileImageUrl
                                    ? 'A mobile image is currently configured.'
                                    : 'The desktop image is currently used on mobile.'}
                                </small>
                              </label>
                              <button className="button button-primary">Save changes</button>
                            </BannerUploadForm>
                          </details>
                          <form action={toggleBanner}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="active" value={String(item.active)} />
                            <button className="banner-action-button">
                              {item.active ? 'Pause' : 'Enable'}
                            </button>
                          </form>
                          <form action={deleteBanner}>
                            <input type="hidden" name="id" value={item.id} />
                            <button className="banner-action-button danger">Delete</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.data.banners.length === 0 && (
                  <div className="panel-empty">No slides have been added yet.</div>
                )}
              </div>
            </article>
            <article className="panel promo-card-panel">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Homepage merchandising</p>
                  <h2>Promotional cards</h2>
                  <p>
                    Manage the image and content for the three feature cards below the categories.
                  </p>
                </div>
                <span className="count-pill">{promoCards.length}</span>
              </header>
              <BannerUploadForm endpoint="/api/promo-cards" className="content-form">
                <input name="eyebrow" placeholder="Eyebrow, e.g. Chilled selection" required />
                <input name="title" placeholder="Card heading" required />
                <textarea
                  className="wide-field"
                  name="description"
                  rows={3}
                  placeholder="Card description"
                  required
                />
                <input name="buttonLabel" placeholder="Button label" required />
                <input
                  name="linkUrl"
                  placeholder="Destination, e.g. /category/fresh-food"
                  required
                />
                <label className="wide-field">
                  Card image
                  <input
                    name="promoImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    required
                  />
                </label>
                <select name="tone" defaultValue="fresh" aria-label="Colour treatment">
                  <option value="fresh">Fresh green</option>
                  <option value="pantry">Pantry olive</option>
                  <option value="drinks">Drinks burgundy</option>
                </select>
                <input name="position" type="number" min="0" defaultValue="0" />
                <button className="button button-primary">Add card</button>
              </BannerUploadForm>
              <div className="promo-card-list">
                {promoCards.map((item) => {
                  const content = item.content;
                  const imageUrl = stringContent(content.imageUrl);
                  return (
                    <article className="promo-card-row" key={item.id}>
                      <div
                        className={`promo-card-preview ${stringContent(content.tone) || 'fresh'}`}
                        style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
                      />
                      <div className="promo-card-copy">
                        <small>{stringContent(content.eyebrow) || 'Promotional card'}</small>
                        <strong>{item.title}</strong>
                        <span>{stringContent(content.description)}</span>
                      </div>
                      <span
                        className={`status-badge ${item.active ? 'status-active' : 'status-down'}`}
                      >
                        <span />
                        {item.active ? 'Active' : 'Inactive'}
                      </span>
                      <div className="banner-actions">
                        <details className="row-editor">
                          <summary className="banner-action-button">Edit</summary>
                          <BannerUploadForm endpoint="/api/promo-cards">
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="currentImageUrl" value={imageUrl} />
                            <input
                              name="eyebrow"
                              defaultValue={stringContent(content.eyebrow)}
                              required
                            />
                            <input name="title" defaultValue={item.title ?? ''} required />
                            <textarea
                              name="description"
                              rows={3}
                              defaultValue={stringContent(content.description)}
                              required
                            />
                            <input
                              name="buttonLabel"
                              defaultValue={stringContent(content.buttonLabel)}
                              required
                            />
                            <input
                              name="linkUrl"
                              defaultValue={stringContent(content.linkUrl)}
                              required
                            />
                            <label className="wide-field">
                              Replace card image
                              <input
                                name="promoImage"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/avif"
                              />
                            </label>
                            <select
                              name="tone"
                              defaultValue={stringContent(content.tone) || 'fresh'}
                            >
                              <option value="fresh">Fresh green</option>
                              <option value="pantry">Pantry olive</option>
                              <option value="drinks">Drinks burgundy</option>
                            </select>
                            <input
                              name="position"
                              type="number"
                              min="0"
                              defaultValue={item.position}
                            />
                            <button className="button button-primary">Save changes</button>
                          </BannerUploadForm>
                        </details>
                        <form action={toggleContentBlock}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="active" value={String(item.active)} />
                          <button className="banner-action-button">
                            {item.active ? 'Pause' : 'Enable'}
                          </button>
                        </form>
                        <form action={deleteContentBlock}>
                          <input type="hidden" name="id" value={item.id} />
                          <button className="banner-action-button danger">Delete</button>
                        </form>
                      </div>
                    </article>
                  );
                })}
                {promoCards.length === 0 && (
                  <div className="panel-empty">No promotional cards have been added.</div>
                )}
              </div>
            </article>
          </section>
          <article className="panel section-gap">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Policies</p>
                <h2>Legal & service pages</h2>
                <p>Saving the same page type and locale updates that page.</p>
              </div>
            </header>
            <form action={saveCmsPage} className="cms-page-form">
              <select name="type">
                <option value="TERMS">Terms</option>
                <option value="PRIVACY">Privacy</option>
                <option value="COOKIE">Cookie policy</option>
                <option value="RETURNS">Returns</option>
                <option value="ALCOHOL_POLICY">Alcohol policy</option>
                <option value="DELIVERY_POLICY">Delivery policy</option>
              </select>
              <input name="locale" defaultValue="en-GB" />
              <input name="title" placeholder="Page title" required />
              <label className="inline-checkbox">
                <input name="published" type="checkbox" /> Publish immediately
              </label>
              <textarea name="content" rows={12} placeholder="Page content" required />
              <button className="button button-primary">Save page</button>
            </form>
            <div className="record-list">
              {result.data.pages.map((item) => (
                <div className="record-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.type.replaceAll('_', ' ')} · {item.locale} · updated{' '}
                      {new Date(item.updatedAt).toLocaleDateString('en-GB')}
                    </small>
                  </div>
                  <span
                    className={`status-badge ${item.published ? 'status-active' : 'status-warn'}`}
                  >
                    <span />
                    {item.published ? 'Published' : 'Draft'}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </>
      )}
    </>
  );
}

function dateTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatSchedule(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return 'Always';
  const format = (value: string) =>
    new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  if (startsAt && endsAt) return `${format(startsAt)} – ${format(endsAt)}`;
  if (startsAt) return `From ${format(startsAt)}`;
  return endsAt ? `Until ${format(endsAt)}` : 'Always';
}

function stringContent(value: unknown) {
  return typeof value === 'string' ? value : '';
}
