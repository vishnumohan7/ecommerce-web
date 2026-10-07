/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { createProduct } from '../../actions';
import { ApiNotice } from '../../components/api-notice';
import { fetchBrands, fetchCategories } from '../../lib/api';

export const metadata: Metadata = { title: 'Add product' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const [categoryResult, brandResult] = await Promise.all([fetchCategories(), fetchBrands()]);
  if (!categoryResult.ok) return <ApiNotice message={categoryResult.error} />;
  if (!brandResult.ok) return <ApiNotice message={brandResult.error} />;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Add product</h1>
          <p>Create a compliant grocery or alcohol product through the live catalogue API.</p>
        </div>
        <Link className="button button-muted" href="/products">
          Cancel
        </Link>
      </section>
      <form action={createProduct} className="panel product-form">
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          SKU
          <input name="sku" required />
        </label>
        <label>
          Slug
          <input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
        </label>
        <label>
          Category
          <select name="categoryId" required>
            <option value="">Select category</option>
            {categoryResult.data.items.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Brand
          <select name="brandId">
            <option value="">No brand</option>
            {brandResult.data.items.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Price (pence)
          <input name="priceMinor" type="number" min="0" required />
        </label>
        <label>
          Unit price display
          <input name="unitPriceDisplay" placeholder="£2.50 each" required />
        </label>
        <label>
          Tax category
          <select name="taxCategory" defaultValue="ZERO">
            <option>ZERO</option>
            <option>STANDARD_20</option>
            <option>REDUCED_5</option>
            <option>EXEMPT</option>
          </select>
        </label>
        <label>
          VAT (basis points)
          <input name="vatRateBps" type="number" min="0" max="10000" defaultValue="0" required />
        </label>
        <label>
          Storage
          <select name="storageType">
            <option>AMBIENT</option>
            <option>CHILLED</option>
            <option>FROZEN</option>
          </select>
        </label>
        <label>
          Origin country
          <input name="countryOfOrigin" defaultValue="GB" minLength={2} maxLength={2} required />
        </label>
        <label className="wide-field">
          Description
          <textarea name="description" rows={4} required />
        </label>
        <label className="checkbox-field">
          <input name="isAlcohol" type="checkbox" /> Alcohol product (forces age 18 and standard
          VAT)
        </label>
        <label>
          ABV %<input name="abv" placeholder="12.5" />
        </label>
        <label>
          Alcohol type
          <select name="alcoholType" defaultValue="WINE">
            <option>BEER</option>
            <option>WINE</option>
            <option>SPIRITS</option>
            <option>CIDER</option>
            <option>OTHER</option>
          </select>
        </label>
        <div className="form-actions">
          <button className="button button-primary" type="submit">
            Create product
          </button>
        </div>
      </form>
      <p className="page-note">Requires catalog.write in ADMIN_API_TOKEN.</p>
    </>
  );
}
