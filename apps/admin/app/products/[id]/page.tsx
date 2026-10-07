/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { archiveProduct, createProductVariant, updateProduct, uploadProductImage } from '../../actions';
import { ActionMessage } from '../../components/action-message';
import { ApiNotice } from '../../components/api-notice';
import { ConfirmSubmitButton } from '../../components/confirm-submit-button';
import { ProductForm } from '../../components/product-form';
import { fetchBrands, fetchCategories, fetchProduct, fetchWarehouses } from '../../lib/api';

export const metadata: Metadata = { title: 'Edit product' };
export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [productResult, categoryResult, brandResult, warehouseResult] = await Promise.all([fetchProduct(id), fetchCategories(), fetchBrands(), fetchWarehouses()]);
  if (!productResult.ok) return <ApiNotice message={productResult.error} />;
  if (!categoryResult.ok) return <ApiNotice message={categoryResult.error} />;
  if (!brandResult.ok) return <ApiNotice message={brandResult.error} />;
  if (!warehouseResult.ok) return <ApiNotice message={warehouseResult.error} />;
  const product = productResult.data;
  return <>
    <section className="page-heading"><div><p className="eyebrow">Product detail</p><h1>{product.name}</h1><p>Edit catalogue, pricing and compliance fields for {product.sku}.</p></div><div className="heading-actions"><Link className="button button-muted" href="/products">Back</Link><form action={archiveProduct}><input type="hidden" name="id" value={product.id} /><ConfirmSubmitButton className="button button-danger" message={`Archive ${product.name}? It will disappear from the storefront.`}>Archive product</ConfirmSubmitButton></form></div></section>
    <ActionMessage success={query.success} error={query.error} />
    <ProductForm action={updateProduct} categories={categoryResult.data.items} brands={brandResult.data.items} product={product} submitLabel="Save product" />
    <div className="catalogue-ops-grid product-operations">
      <article className="panel">
        <div className="panel-header"><div><p className="eyebrow">Sellable options</p><h2>Variants</h2><p>Create packs, sizes or flavours with their own price and opening stock.</p></div><span className="count-badge">{product.variants?.length ?? 0}</span></div>
        {product.variants?.length ? <div className="record-list">{product.variants.map((variant) => <div className="record-row" key={variant.id}><div><strong>{variant.name}</strong><small>{variant.sku}{variant.packSize ? ` · ${variant.packSize}` : ''}</small></div><div className="record-meta"><strong>£{(Number(variant.priceMinor) / 100).toFixed(2)}</strong></div></div>)}</div> : <div className="empty-state compact-empty"><h3>No variants</h3><p>The base product can still be sold without variants.</p></div>}
        <form action={createProductVariant} className="product-form compact-operation-form">
          <input type="hidden" name="id" value={product.id} />
          <label>Variant name<input name="name" required placeholder="750 ml bottle" /></label>
          <label>Variant SKU<input name="sku" required placeholder={`${product.sku}-750`} /></label>
          <label>Price (pence)<input name="priceMinor" inputMode="numeric" required /></label>
          <label>Pack size<input name="packSize" placeholder="6 × 330 ml" /></label>
          <label>Weight (grams)<input name="weightGrams" type="number" min="1" /></label>
          <label>Flavour<input name="flavour" /></label>
          <label>Warehouse<select name="warehouseId" required>{warehouseResult.data.map((warehouse) => <option value={warehouse.id} key={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}</select></label>
          <label>Opening stock<input name="stockOnHand" type="number" min="0" defaultValue="0" required /></label>
          <label>Low-stock alert<input name="lowStockThreshold" type="number" min="0" defaultValue="5" required /></label>
          {product.isAlcohol && <label>ABV %<input name="abv" inputMode="decimal" defaultValue={product.abv ?? ''} /></label>}
          <label className="wide-field">Attributes JSON<input name="attributes" defaultValue="{}" /></label>
          <div className="form-actions"><button className="button button-primary" type="submit">Add variant</button></div>
        </form>
      </article>
      <article className="panel">
        <div className="panel-header"><div><p className="eyebrow">Product media</p><h2>Images</h2><p>Uploads are safely re-encoded into storefront-ready assets.</p></div><span className="count-badge">{product.images?.length ?? 0}</span></div>
        {product.images?.length ? <div className="image-records">{product.images.map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><span className="image-preview" style={{ backgroundImage: `url(${item.url})` }} /><strong>{item.altText}</strong><small>Position {item.position + 1}</small></a>)}</div> : <div className="empty-state compact-empty"><h3>No product images</h3><p>Upload the first image below.</p></div>}
        <form action={uploadProductImage} className="product-form compact-operation-form">
          <input type="hidden" name="id" value={product.id} />
          <label className="wide-field">Image file<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
          <label className="wide-field">Accessible alt text<input name="altText" required placeholder={`${product.name} product image`} /></label>
          <div className="form-actions"><button className="button button-primary" type="submit">Upload image</button></div>
        </form>
      </article>
    </div>
  </>;
}
