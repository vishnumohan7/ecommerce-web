/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { createBrand, removeTaxonomy } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { ConfirmSubmitButton } from '../components/confirm-submit-button';
import { TablePagination } from '../components/table-pagination';
import { fetchAdminBrands } from '../lib/api';

export const metadata: Metadata = { title: 'Brands' };
export const dynamic = 'force-dynamic';
interface Props {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    success?: string;
    error?: string;
  }>;
}

export default async function BrandsPage({ searchParams }: Props) {
  const query = await searchParams;
  const result = await fetchAdminBrands({
    page: Number(query.page) || 1,
    ...(query.q ? { q: query.q } : {}),
    ...(query.sort ? { sort: query.sort } : {}),
  });
  if (!result.ok) return <ApiNotice message={result.error} />;
  const brands = result.data.items;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Merchandising</p>
          <h1>Brands</h1>
          <p>Manage the brand names and imagery shown across the storefront.</p>
        </div>
        <Link className="button button-muted" href="/categories">
          View categories
        </Link>
      </section>
      <ActionMessage success={query.success} error={query.error} />
      <article className="panel taxonomy-page-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">New brand</p>
            <h2>Add brand</h2>
            <p>Upload a clean logo or brand image for product browsing.</p>
          </div>
          <span className="count-badge">{result.data.total} brands</span>
        </div>
        <form action={createBrand} className="taxonomy-page-form brand-page-form">
          <label className="form-field">
            <span>Brand name</span>
            <input name="name" placeholder="e.g. Coca-Cola" required />
          </label>
          <label className="form-field">
            <span>URL slug</span>
            <input
              name="slug"
              placeholder="coca-cola"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </label>
          <label className="form-field taxonomy-image-field">
            <span>Brand image or logo</span>
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
            />
            <small>Use a square or landscape image with clear spacing around the logo.</small>
          </label>
          <button className="button button-primary" type="submit">
            Add brand
          </button>
        </form>
        <form action="/brands" className="order-filters taxonomy-filters">
          <input
            aria-label="Search brands"
            name="q"
            defaultValue={query.q}
            placeholder="Search brand name or slug"
          />
          <select aria-label="Sort brands" name="sort" defaultValue={query.sort ?? 'name-asc'}>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <button className="button button-muted">Filter</button>
          {(query.q || query.sort) && (
            <Link className="clear-link" href="/brands">
              Clear
            </Link>
          )}
        </form>
        {brands.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>No brands found</h3>
            <p>Try another search or clear the current filters.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="taxonomy-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Slug</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="taxonomy-name-cell">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" />
                        ) : (
                          <span className="taxonomy-image-placeholder">{item.name.charAt(0)}</span>
                        )}
                        <strong>{item.name}</strong>
                      </div>
                    </td>
                    <td>/{item.slug}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="text-action" href={`/brands/${item.id}`}>
                          Edit
                        </Link>
                        <form action={removeTaxonomy}>
                          <input type="hidden" name="kind" value="brand" />
                          <input type="hidden" name="id" value={item.id} />
                          <ConfirmSubmitButton
                            className="text-action danger-action"
                            message={`Permanently delete ${item.name}? This only succeeds when no products use it.`}
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TablePagination
          basePath="/brands"
          page={result.data.page}
          pageCount={result.data.pageCount}
          total={result.data.total}
          params={{
            ...(query.q ? { q: query.q } : {}),
            ...(query.sort ? { sort: query.sort } : {}),
          }}
        />
      </article>
    </>
  );
}
