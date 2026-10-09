/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  adjustInventory,
  createProductInventory,
  createProductVariant,
  deleteProductImage,
  deleteProduct,
  deleteProductInventory,
  deleteProductVariant,
  updateProduct,
  updateProductInventory,
  updateProductVariant,
  uploadProductImage,
} from '../../actions';
import { ActionMessage } from '../../components/action-message';
import { ApiNotice } from '../../components/api-notice';
import { ConfirmSubmitButton } from '../../components/confirm-submit-button';
import { ProductForm } from '../../components/product-form';
import {
  fetchBrands,
  fetchCategories,
  fetchInventory,
  fetchProduct,
  fetchWarehouses,
} from '../../lib/api';

export const metadata: Metadata = { title: 'Edit product' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [productResult, categoryResult, brandResult, warehouseResult, inventoryResult] =
    await Promise.all([
      fetchProduct(id),
      fetchCategories(),
      fetchBrands(),
      fetchWarehouses(),
      fetchInventory(id),
    ]);
  if (!productResult.ok) return <ApiNotice message={productResult.error} />;
  if (!categoryResult.ok) return <ApiNotice message={categoryResult.error} />;
  if (!brandResult.ok) return <ApiNotice message={brandResult.error} />;
  if (!warehouseResult.ok) return <ApiNotice message={warehouseResult.error} />;
  if (!inventoryResult.ok) return <ApiNotice message={inventoryResult.error} />;
  const product = productResult.data;
  const warehouseNames = new Map(
    warehouseResult.data.map((warehouse) => [warehouse.id, warehouse]),
  );
  const variantNames = new Map(
    product.variants?.map((variant) => [variant.id, variant.name]) ?? [],
  );
  const usedWarehouseIds = new Set(
    inventoryResult.data.filter((row) => !row.variantId).map((row) => row.warehouseId),
  );
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Product detail</p>
          <h1>{product.name}</h1>
          <p>Edit catalogue, pricing and compliance fields for {product.sku}.</p>
        </div>
        <div className="heading-actions">
          <Link className="button button-muted" href="/products">
            Back
          </Link>
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={product.id} />
            <ConfirmSubmitButton
              className="button button-danger"
              message={`Delete ${product.name}? Products used in previous orders will be retained internally for invoices and reports.`}
            >
              Delete product
            </ConfirmSubmitButton>
          </form>
        </div>
      </section>
      <ActionMessage success={query.success} error={query.error} />
      <ProductForm
        action={updateProduct}
        categories={categoryResult.data.items}
        brands={brandResult.data.items}
        product={product}
        submitLabel="Save product"
      />
      <article className="panel product-stock-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Stock keeping</p>
            <h2>Inventory by warehouse</h2>
            <p>Manage on-hand quantity and low-stock alerts without leaving this product.</p>
          </div>
          <span className="count-badge">
            {inventoryResult.data.reduce((total, row) => total + row.stockAvailable, 0)} available
          </span>
        </div>
        {inventoryResult.data.length ? (
          <div className="stock-location-list">
            {inventoryResult.data.map((row) => {
              const warehouse = warehouseNames.get(row.warehouseId);
              return (
                <section className="stock-location-card" key={row.id}>
                  <div className="stock-location-summary">
                    <div>
                      <strong>{warehouse?.name ?? 'Warehouse'}</strong>
                      <small>
                        {warehouse?.code ?? row.warehouseId}
                        {row.variantId
                          ? ` · ${variantNames.get(row.variantId) ?? 'Variant'}`
                          : ' · Base product'}
                      </small>
                    </div>
                    <dl>
                      <div>
                        <dt>On hand</dt>
                        <dd>{row.onHand}</dd>
                      </div>
                      <div>
                        <dt>Reserved</dt>
                        <dd>{row.reserved}</dd>
                      </div>
                      <div>
                        <dt>Available</dt>
                        <dd
                          className={
                            row.stockAvailable <= row.lowStockThreshold ? 'stock-low' : 'stock-good'
                          }
                        >
                          {row.stockAvailable}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="stock-location-actions">
                    <form action={adjustInventory} className="stock-inline-form">
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="productId" value={product.id} />
                      <label>
                        Quantity change
                        <input name="quantity" type="number" placeholder="+10 or -2" required />
                      </label>
                      <label>
                        Reason
                        <select name="reason">
                          <option value="PURCHASE">Stock receipt</option>
                          <option value="ADJUSTMENT">Correction</option>
                          <option value="WASTAGE">Wastage</option>
                          <option value="RETURN">Customer return</option>
                        </select>
                      </label>
                      <label>
                        Reference
                        <input name="reference" placeholder="PO / note" />
                      </label>
                      <button className="button button-secondary">Apply</button>
                    </form>
                    <form action={updateProductInventory} className="stock-threshold-form">
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="productId" value={product.id} />
                      <label>
                        Low-stock alert
                        <input
                          name="lowStockThreshold"
                          type="number"
                          min="0"
                          defaultValue={row.lowStockThreshold}
                          required
                        />
                      </label>
                      <button className="button button-muted">Update alert</button>
                    </form>
                    <form action={deleteProductInventory}>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="productId" value={product.id} />
                      <ConfirmSubmitButton
                        className="text-action danger-action"
                        message="Delete this empty stock location? Stock and transaction history must be empty."
                      >
                        Delete location
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <h3>No stock location</h3>
            <p>Add opening stock below so this product can be sold.</p>
          </div>
        )}
        {warehouseResult.data.some((warehouse) => !usedWarehouseIds.has(warehouse.id)) && (
          <form action={createProductInventory} className="stock-create-form">
            <input type="hidden" name="productId" value={product.id} />
            <label>
              Warehouse
              <select name="warehouseId" required>
                <option value="">Select warehouse</option>
                {warehouseResult.data
                  .filter((warehouse) => !usedWarehouseIds.has(warehouse.id))
                  .map((warehouse) => (
                    <option value={warehouse.id} key={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Opening stock
              <input name="stockOnHand" type="number" min="0" defaultValue="0" required />
            </label>
            <label>
              Low-stock alert
              <input name="lowStockThreshold" type="number" min="0" defaultValue="5" required />
            </label>
            <button className="button button-primary">Add stock location</button>
          </form>
        )}
      </article>
      <div className="catalogue-ops-grid product-operations">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Sellable options</p>
              <h2>Variants</h2>
              <p>Create packs, sizes or flavours with their own price and opening stock.</p>
            </div>
            <span className="count-badge">{product.variants?.length ?? 0}</span>
          </div>
          {product.variants?.length ? (
            <div className="record-list">
              {product.variants.map((variant) => (
                <details className="variant-editor" key={variant.id}>
                  <summary>
                    <span><strong>{variant.name}</strong><small>{variant.sku}{variant.packSize ? ` · ${variant.packSize}` : ''}</small></span>
                    <span className="record-meta"><strong>£{(Number(variant.priceMinor) / 100).toFixed(2)}</strong><small>{variant.active ? 'Active' : 'Inactive'}</small></span>
                  </summary>
                  <form action={updateProductVariant} className="variant-edit-form">
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="variantId" value={variant.id} />
                    <label>Name<input name="name" defaultValue={variant.name} required /></label>
                    <label>SKU<input name="sku" defaultValue={variant.sku} required /></label>
                    <label>Price (pence)<input name="priceMinor" type="number" min="0" defaultValue={variant.priceMinor} required /></label>
                    <label>Pack size<input name="packSize" defaultValue={variant.packSize ?? ''} /></label>
                    <label>Weight (grams)<input name="weightGrams" type="number" min="1" defaultValue={variant.weightGrams ?? ''} /></label>
                    <label>Flavour<input name="flavour" defaultValue={variant.flavour ?? ''} /></label>
                    {product.isAlcohol && <label>ABV %<input name="abv" defaultValue={variant.abv ?? ''} /></label>}
                    <label className="wide-field">Attributes JSON<input name="attributes" defaultValue={JSON.stringify(variant.attributes ?? {})} /></label>
                    <label className="checkbox-field"><input name="active" type="checkbox" defaultChecked={variant.active} /> Available for sale</label>
                    <div className="variant-actions">
                      <button className="button button-primary">Save variant</button>
                    </div>
                  </form>
                  <form action={deleteProductVariant} className="variant-delete-form">
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="variantId" value={variant.id} />
                    <ConfirmSubmitButton className="text-action danger-action" message={`Delete ${variant.name}? Variants with stock or transaction history will be deactivated instead.`}>Delete variant</ConfirmSubmitButton>
                  </form>
                </details>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <h3>No variants</h3>
              <p>The base product can still be sold without variants.</p>
            </div>
          )}
          <form action={createProductVariant} className="product-form compact-operation-form">
            <input type="hidden" name="id" value={product.id} />
            <label>
              Variant name
              <input name="name" required placeholder="750 ml bottle" />
            </label>
            <label>
              Variant SKU
              <input name="sku" required placeholder={`${product.sku}-750`} />
            </label>
            <label>
              Price (pence)
              <input name="priceMinor" inputMode="numeric" required />
            </label>
            <label>
              Pack size
              <input name="packSize" placeholder="6 × 330 ml" />
            </label>
            <label>
              Weight (grams)
              <input name="weightGrams" type="number" min="1" />
            </label>
            <label>
              Flavour
              <input name="flavour" />
            </label>
            <label>
              Warehouse
              <select name="warehouseId" required>
                {warehouseResult.data.map((warehouse) => (
                  <option value={warehouse.id} key={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Opening stock
              <input name="stockOnHand" type="number" min="0" defaultValue="0" required />
            </label>
            <label>
              Low-stock alert
              <input name="lowStockThreshold" type="number" min="0" defaultValue="5" required />
            </label>
            {product.isAlcohol && (
              <label>
                ABV %<input name="abv" inputMode="decimal" defaultValue={product.abv ?? ''} />
              </label>
            )}
            <label className="wide-field">
              Attributes JSON
              <input name="attributes" defaultValue="{}" />
            </label>
            <div className="form-actions">
              <button className="button button-primary" type="submit">
                Add variant
              </button>
            </div>
          </form>
        </article>
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Product media</p>
              <h2>Images</h2>
              <p>Uploads are safely re-encoded into storefront-ready assets.</p>
            </div>
            <span className="count-badge">{product.images?.length ?? 0}</span>
          </div>
          {product.images?.length ? (
            <div className="image-records">
              {product.images.map((item) => (
                <div className="image-record" key={item.id}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    <span className="image-preview" style={{ backgroundImage: `url(${item.url})` }} />
                    <strong>{item.altText}</strong>
                    <small>{item.position === 0 ? 'Featured image' : `Gallery position ${item.position}`}</small>
                  </a>
                  <form action={deleteProductImage}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="imageId" value={item.id} />
                    <ConfirmSubmitButton className="text-action danger-action" message={`Delete ${item.position === 0 ? 'the featured image' : 'this gallery image'}?`}>Delete</ConfirmSubmitButton>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <h3>No product images</h3>
              <p>Upload the first image below.</p>
            </div>
          )}
          <form action={uploadProductImage} className="product-form compact-operation-form">
            <input type="hidden" name="id" value={product.id} />
            <label className="wide-field">
              Image file
              <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
            </label>
            <label className="wide-field">
              Accessible alt text
              <input name="altText" required placeholder={`${product.name} product image`} />
            </label>
            <label className="checkbox-field wide-field">
              <input name="featured" type="checkbox" defaultChecked={!product.images?.length} />
              Make this the featured product image
            </label>
            <div className="form-actions">
              <button className="button button-primary" type="submit">
                Upload image
              </button>
            </div>
          </form>
        </article>
      </div>
    </>
  );
}
