/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { createCategory, removeTaxonomy } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { ConfirmSubmitButton } from '../components/confirm-submit-button';
import { fetchCategories } from '../lib/api';

export const metadata: Metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';
interface Props {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function CategoriesPage({ searchParams }: Props) {
  const [query, result] = await Promise.all([searchParams, fetchCategories()]);
  if (!result.ok) return <ApiNotice message={result.error} />;
  const categories = result.data.items;
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
          <span className="count-badge">{categories.length} categories</span>
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
              {categories.map((item) => (
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
                  <td>
                    {categories.find((candidate) => candidate.id === item.parentId)?.name ??
                      'Top level'}
                  </td>
                  <td>{item.position}</td>
                  <td>
                    <span className="status-badge status-active">
                      <span />
                      Active
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
                        <ConfirmSubmitButton
                          className="text-action danger-action"
                          message={`Archive ${item.name}? Child categories and active products must be removed first.`}
                        >
                          Archive
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
