/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { updateCategory } from '../../actions';
import { ApiNotice } from '../../components/api-notice';
import { fetchCategories, fetchCategory } from '../../lib/api';

export const metadata: Metadata = { title: 'Edit category' };
export const dynamic = 'force-dynamic';
interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;
  const [item, list] = await Promise.all([fetchCategory(id), fetchCategories()]);
  if (!item.ok) return <ApiNotice message={item.error} />;
  if (!list.ok) return <ApiNotice message={list.error} />;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Category detail</p>
          <h1>Edit {item.data.name}</h1>
          <p>Update the storefront identity and category hierarchy.</p>
        </div>
        <Link className="button button-muted" href="/categories">
          Back to categories
        </Link>
      </section>
      <form action={updateCategory} className="panel taxonomy-detail-form">
        <input type="hidden" name="id" value={item.data.id} />
        <div className="taxonomy-current-image">
          {item.data.imageUrl ? (
            <img src={item.data.imageUrl} alt={`${item.data.name} category`} />
          ) : (
            <span>{item.data.name.charAt(0)}</span>
          )}
          <div>
            <strong>Current image</strong>
            <small>Upload a file below only when it needs replacing.</small>
          </div>
        </div>
        <label className="form-field">
          <span>Category name</span>
          <input name="name" defaultValue={item.data.name} required />
        </label>
        <label className="form-field">
          <span>URL slug</span>
          <input
            name="slug"
            defaultValue={item.data.slug}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            required
          />
        </label>
        <label className="form-field">
          <span>Parent category</span>
          <select name="parentId" defaultValue={item.data.parentId ?? ''}>
            <option value="">None — top level</option>
            {list.data.items
              .filter((candidate) => candidate.id !== item.data.id)
              .map((candidate) => (
                <option value={candidate.id} key={candidate.id}>
                  {candidate.name}
                </option>
              ))}
          </select>
        </label>
        <label className="form-field">
          <span>Display position</span>
          <input name="position" type="number" min="0" defaultValue={item.data.position} required />
        </label>
        <label className="form-field wide-field">
          <span>Replace category image</span>
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" />
          <small>Leave empty to keep the current image.</small>
        </label>
        <div className="form-actions">
          <button className="button button-primary">Save category</button>
        </div>
      </form>
    </>
  );
}
