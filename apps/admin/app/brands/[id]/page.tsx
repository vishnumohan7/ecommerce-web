/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { updateBrand } from '../../actions';
import { ApiNotice } from '../../components/api-notice';
import { fetchBrand } from '../../lib/api';

export const metadata: Metadata = { title: 'Edit brand' };
export const dynamic = 'force-dynamic';
interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditBrandPage({ params }: Props) {
  const { id } = await params;
  const result = await fetchBrand(id);
  if (!result.ok) return <ApiNotice message={result.error} />;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Brand detail</p>
          <h1>Edit {result.data.name}</h1>
          <p>Update the brand identity shown on product and browsing pages.</p>
        </div>
        <Link className="button button-muted" href="/brands">
          Back to brands
        </Link>
      </section>
      <form action={updateBrand} className="panel taxonomy-detail-form">
        <input type="hidden" name="id" value={result.data.id} />
        <div className="taxonomy-current-image">
          {result.data.imageUrl ? (
            <img src={result.data.imageUrl} alt={`${result.data.name} brand`} />
          ) : (
            <span>{result.data.name.charAt(0)}</span>
          )}
          <div>
            <strong>Current brand image</strong>
            <small>Upload a file below only when it needs replacing.</small>
          </div>
        </div>
        <label className="form-field">
          <span>Brand name</span>
          <input name="name" defaultValue={result.data.name} required />
        </label>
        <label className="form-field">
          <span>URL slug</span>
          <input
            name="slug"
            defaultValue={result.data.slug}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            required
          />
        </label>
        <label className="form-field wide-field">
          <span>Replace brand image</span>
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" />
          <small>Leave empty to keep the current image.</small>
        </label>
        <div className="form-actions">
          <button className="button button-primary">Save brand</button>
        </div>
      </form>
    </>
  );
}
