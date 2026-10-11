/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { createCategory, removeTaxonomy } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { ConfirmSubmitButton } from '../components/confirm-submit-button';
import { TablePagination } from '../components/table-pagination';
import { fetchAdminCategories, fetchCategories } from '../lib/api';

export const metadata: Metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';
interface Props {
  searchParams: Promise<{
    q?: string;
    page?: string;
    status?: string;
    sort?: string;
    success?: string;
    error?: string;
  }>;
}

export default async function CategoriesPage({ searchParams }: Props) {
  const query = await searchParams;
  const [result, parentResult] = await Promise.all([
    fetchAdminCategories({
      page: Number(query.page) || 1,
      ...(query.q ? { q: query.q } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.sort ? { sort: query.sort } : {}),
    }),
    fetchCategories(),
  ]);
  if (!result.ok) return <ApiNotice message={result.error} />;
  if (!parentResult.ok) return <ApiNotice message={parentResult.error} />;
  const categories = result.data.items;
  const parentOptions = parentResult.data.items;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Catalogue structure</p>
          <h1>Categories</h1>
          <p>Organise products into storefront departments and subcategories.</p>
        </div>
        <Link className="button button-muted" href="/brands">
          View brands
        </Link>
      </section>
      <ActionMessage success={query.success} error={query.error} />
      <article className="panel taxonomy-page-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">New category</p>
            <h2>Add category</h2>
            <p>Upload its storefront image and choose its position in the hierarchy.</p>
          </div>
          <span className="count-badge">{result.data.total} categories</span>
        </div>
        <form action={createCategory} className="taxonomy-page-form">
          <label className="form-field">
            <span>Category name</span>
            <input name="name" placeholder="e.g. Fresh food" required />
          </label>
          <label className="form-field">
            <span>URL slug</span>
            <input
              name="slug"
              placeholder="fresh-food"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </label>
          <label className="form-field">
            <span>Parent category</span>
            <select name="parentId" defaultValue="">
              <option value="">None — top level</option>
              {parentOptions.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Display position</span>
            <input name="position" type="number" min="0" defaultValue="0" required />
          </label>
          <label className="form-field taxonomy-image-field">
            <span>Category image</span>
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
            />
            <small>JPEG, PNG, WebP or AVIF. The upload is safely resized for the storefront.</small>
          </label>
          <button className="button button-primary" type="submit">
            Add category
          </button>
        </form>
        <form action="/categories" className="order-filters taxonomy-filters">
          <input
            aria-label="Search categories"
            name="q"
            defaultValue={query.q}
            placeholder="Search name, slug or path"
          />
          <select aria-label="Category status" name="status" defaultValue={query.status ?? ''}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select aria-label="Sort categories" name="sort" defaultValue={query.sort ?? 'name-asc'}>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="position">Display position</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <button className="button button-muted">Filter</button>
          {(query.q || query.status || query.sort) && (
            <Link className="clear-link" href="/categories">
              Clear
            </Link>
          )}
        </form>
        {categories.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>No categories found</h3>
            <p>Try another search or clear the current filters.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="taxonomy-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Parent</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="taxonomy-name-cell">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" />
                        ) : (
                          <span className="taxonomy-image-placeholder">{item.name.charAt(0)}</span>
                        )}
                        <div>
                          <strong>{item.name}</strong>
                          <small>{item.path}</small>
                        </div>
                      </div>
                    </td>
                    <td>{item.parentName ?? 'Top level'}</td>
                    <td>{item.position}</td>
                    <td>
                      <span
                        className={`status-badge ${item.active ? 'status-active' : 'status-inactive'}`}
                      >
                        <span />
                        {item.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link className="text-action" href={`/categories/${item.id}`}>
                          Edit
                        </Link>
                        <form action={removeTaxonomy}>
                          <input type="hidden" name="kind" value="category" />
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="cascade" value="true" />
                          <ConfirmSubmitButton
                            className="text-action danger-action"
                            message={`Delete ${item.name} and all of its child categories? This is permanent and will be blocked if any products still use the category group.`}
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
          basePath="/categories"
          page={result.data.page}
          pageCount={result.data.pageCount}
          total={result.data.total}
          params={{
            ...(query.q ? { q: query.q } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.sort ? { sort: query.sort } : {}),
          }}
        />
      </article>
    </>
  );
}
