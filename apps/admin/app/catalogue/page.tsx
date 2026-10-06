/* eslint-disable local/no-jsx-literals -- Milestone 17 admin preview is English-only. */
import type { Metadata } from 'next';
import { createBrand, createCategory, removeTaxonomy, updateBrand, updateCategory } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { ConfirmSubmitButton } from '../components/confirm-submit-button';
import { fetchBrands, fetchCategories } from '../lib/api';

export const metadata: Metadata = { title: 'Categories & brands' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function CataloguePage({ searchParams }: PageProps) {
  const [params, categoriesResult, brandsResult] = await Promise.all([
    searchParams,
    fetchCategories(),
    fetchBrands(),
  ]);
  const categories = categoriesResult.ok ? categoriesResult.data.items : [];
  const brands = brandsResult.ok ? brandsResult.data.items : [];
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Catalogue structure</p>
          <h1>Categories & brands</h1>
          <p>Live taxonomy data with authenticated create and archive operations.</p>
        </div>
      </section>
      <ActionMessage success={params.success} error={params.error} />
      {!categoriesResult.ok && <ApiNotice message={categoriesResult.error} />}
      {!brandsResult.ok && <ApiNotice message={brandsResult.error} />}
      <section className="admin-grid">
        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Hierarchy</p>
              <h2>Categories</h2>
            </div>
            <span className="count-pill">{categories.length}</span>
          </header>
          <form action={createCategory} className="inline-create">
            <input name="name" placeholder="Category name" required />
            <input
              name="slug"
              placeholder="category-slug"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
            <select name="parentId" defaultValue="">
              <option value="">Top level</option>
              {categories.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input name="position" type="number" min="0" defaultValue="0" aria-label="Position" />
            <button className="button button-primary" type="submit">
              Add category
            </button>
          </form>
          <div className="record-list">
            {categories.map((item) => (
              <div className="record-row taxonomy-record" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.path}</small>
                </div>
                <span className="soft-badge">Position {item.position}</span>
                <details className="edit-disclosure">
                  <summary className="text-action">Edit</summary>
                  <form action={updateCategory} className="taxonomy-edit-form">
                    <input type="hidden" name="id" value={item.id} />
                    <input name="name" defaultValue={item.name} aria-label="Category name" required />
                    <input name="slug" defaultValue={item.slug} aria-label="Category slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
                    <select name="parentId" defaultValue={item.parentId ?? ''} aria-label="Parent category"><option value="">Top level</option>{categories.filter((candidate) => candidate.id !== item.id).map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select>
                    <input name="position" type="number" min="0" defaultValue={item.position} aria-label="Position" required />
                    <button className="button button-primary" type="submit">Save</button>
                  </form>
                </details>
                <form action={removeTaxonomy}>
                  <input type="hidden" name="kind" value="category" />
                  <input type="hidden" name="id" value={item.id} />
                  <ConfirmSubmitButton message={`Archive ${item.name}? Child categories and active products must be removed first.`}>
                    Archive
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">Merchandising</p>
              <h2>Brands</h2>
            </div>
            <span className="count-pill">{brands.length}</span>
          </header>
          <form action={createBrand} className="inline-create compact-form">
            <input name="name" placeholder="Brand name" required />
            <input
              name="slug"
              placeholder="brand-slug"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
            <button className="button button-primary" type="submit">
              Add brand
            </button>
          </form>
          <div className="record-list">
            {brands.map((item) => (
              <div className="record-row taxonomy-record" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>/{item.slug}</small>
                </div>
                <details className="edit-disclosure">
                  <summary className="text-action">Edit</summary>
                  <form action={updateBrand} className="taxonomy-edit-form compact">
                    <input type="hidden" name="id" value={item.id} />
                    <input name="name" defaultValue={item.name} aria-label="Brand name" required />
                    <input name="slug" defaultValue={item.slug} aria-label="Brand slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
                    <button className="button button-primary" type="submit">Save</button>
                  </form>
                </details>
                <form action={removeTaxonomy}>
                  <input type="hidden" name="kind" value="brand" />
                  <input type="hidden" name="id" value={item.id} />
                  <ConfirmSubmitButton message={`Permanently delete ${item.name}? This only succeeds when no products use it.`}>
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>
        </article>
      </section>
      <p className="page-note">
        Write actions require a server-side ADMIN_API_TOKEN with catalog.write permission.
      </p>
    </>
  );
}
