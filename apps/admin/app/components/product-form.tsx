/* eslint-disable local/no-jsx-literals -- Admin form labels are English-only. */
import type { Brand, Category, Product, Warehouse } from '../lib/api';
import { ProductVariantFields } from './product-variant-fields';

interface Props {
  action: (data: FormData) => void | Promise<void>;
  brands: Brand[];
  categories: Category[];
  product?: Product;
  warehouses?: Warehouse[];
  submitLabel: string;
}

export function ProductForm({
  action,
  brands,
  categories,
  product,
  warehouses = [],
  submitLabel,
}: Readonly<Props>) {
  return (
    <form action={action} className="panel product-form">
      {product && <input type="hidden" name="id" value={product.id} />}
      <label>
        Name
        <input name="name" defaultValue={product?.name} required />
      </label>
      <label>
        SKU
        <input name="sku" defaultValue={product?.sku} required />
      </label>
      <label>
        Slug
        <input
          name="slug"
          defaultValue={product?.slug}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
      </label>
      <label>
        Category
        <select name="categoryId" defaultValue={product?.categoryId ?? ''} required>
          <option value="">Select category</option>
          {categories.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Brand
        <select name="brandId" defaultValue={product?.brandId ?? ''}>
          <option value="">No brand</option>
          {brands.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Price (pence)
        <input
          name="priceMinor"
          type="number"
          min="0"
          defaultValue={product?.priceMinor}
          required
        />
      </label>
      <label>
        Unit price display
        <input
          name="unitPriceDisplay"
          defaultValue={product?.unitPriceDisplay}
          placeholder="£2.50 each"
          required
        />
      </label>
      <label>
        Pricing mode
        <select name="pricingMode" defaultValue={product?.pricingMode ?? 'UNIT'}>
          <option value="UNIT">Per unit</option>
          <option value="WEIGHT_ESTIMATED">Estimated weight</option>
        </select>
      </label>
      <label>
        Price per kg (pence)
        <input
          name="pricePerKgMinor"
          type="number"
          min="0"
          defaultValue={product?.pricePerKgMinor ?? ''}
        />
      </label>
      <label>
        Estimated weight (grams)
        <input
          name="estimatedWeightGrams"
          type="number"
          min="1"
          defaultValue={product?.estimatedWeightGrams ?? ''}
        />
      </label>
      <label>
        Weight tolerance (bps)
        <input
          name="weightToleranceBps"
          type="number"
          min="0"
          max="10000"
          defaultValue={product?.weightToleranceBps ?? ''}
        />
      </label>
      <label>
        Tax category
        <select name="taxCategory" defaultValue={product?.taxCategory ?? 'ZERO'}>
          <option>ZERO</option>
          <option>STANDARD_20</option>
          <option>REDUCED_5</option>
          <option>EXEMPT</option>
        </select>
      </label>
      <label>
        VAT (basis points)
        <input
          name="vatRateBps"
          type="number"
          min="0"
          max="10000"
          defaultValue={product?.vatRateBps ?? 0}
          required
        />
      </label>
      <label>
        Return policy
        <select name="returnPolicy" defaultValue={product?.returnPolicy ?? 'STANDARD_14_DAY'}>
          <option>STANDARD_14_DAY</option>
          <option>PERISHABLE_EXEMPT</option>
          <option>NON_RETURNABLE</option>
        </select>
      </label>
      <label>
        Storage
        <select name="storageType" defaultValue={product?.storageType ?? 'AMBIENT'}>
          <option>AMBIENT</option>
          <option>CHILLED</option>
          <option>FROZEN</option>
        </select>
      </label>
      <label>
        Origin country
        <input
          name="countryOfOrigin"
          defaultValue={product?.countryOfOrigin ?? 'GB'}
          minLength={2}
          maxLength={2}
          required
        />
      </label>
      <label>
        Shelf life (days)
        <input
          name="shelfLifeDays"
          type="number"
          min="1"
          defaultValue={product?.shelfLifeDays ?? ''}
        />
      </label>
      <label>
        HFSS status
        <select name="hfssStatus" defaultValue={product?.hfssStatus ?? 'NOT_IN_SCOPE'}>
          <option>NOT_IN_SCOPE</option>
          <option>IN_SCOPE</option>
        </select>
      </label>
      <label>
        HFSS category
        <input name="hfssCategory" defaultValue={product?.hfssCategory ?? ''} />
      </label>
      <label>
        Dietary tags (comma-separated)
        <input name="dietaryTags" defaultValue={product?.dietaryTags.join(', ')} />
      </label>
      <label>
        Allergens (comma-separated)
        <input name="allergens" defaultValue={product?.allergens.join(', ')} />
      </label>
      <label className="wide-field">
        Description
        <textarea name="description" rows={4} defaultValue={product?.description} required />
      </label>
      <label className="checkbox-field">
        <input name="isAlcohol" type="checkbox" defaultChecked={product?.isAlcohol} /> Alcohol
        product (forces age 18 and standard VAT)
      </label>
      <label>
        ABV %<input name="abv" defaultValue={product?.abv ?? ''} placeholder="12.5" />
      </label>
      <label>
        Alcohol type
        <select name="alcoholType" defaultValue={product?.alcoholType ?? 'WINE'}>
          <option>BEER</option>
          <option>WINE</option>
          <option>SPIRITS</option>
          <option>CIDER</option>
          <option>OTHER</option>
        </select>
      </label>
      {!product && (
        <>
          <div className="form-section-heading wide-field">
            <span>Product images</span>
            <small>
              Add the primary listing image and optional gallery images. JPEG, PNG, WebP and AVIF
              files are supported up to 10 MB each.
            </small>
          </div>
          <label className="product-image-upload">
            Featured image
            <input
              name="featuredImage"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
            />
          </label>
          <label>
            Featured image description
            <input name="featuredImageAltText" placeholder="Defaults to the product name" />
          </label>
          <label className="product-gallery-upload wide-field">
            Gallery images
            <input
              name="galleryImages"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
            />
            <small>
              Select multiple images together. They appear after the featured image in selection
              order.
            </small>
          </label>
          <div className="form-section-heading wide-field">
            <span>Opening stock</span>
            <small>Create the first warehouse stock record with this product.</small>
          </div>
          <label>
            Warehouse
            <select name="warehouseId" required>
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option value={warehouse.id} key={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            In-stock quantity
            <input name="stockOnHand" type="number" min="0" defaultValue="0" required />
          </label>
          <label>
            Low-stock alert at
            <input name="lowStockThreshold" type="number" min="0" defaultValue="5" required />
          </label>
          <ProductVariantFields warehouses={warehouses} />
        </>
      )}
      <div className="form-actions">
        <button className="button button-primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
