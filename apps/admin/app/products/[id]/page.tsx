/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { archiveProduct, updateProduct } from '../../actions';
import { ActionMessage } from '../../components/action-message';
import { ApiNotice } from '../../components/api-notice';
import { ConfirmSubmitButton } from '../../components/confirm-submit-button';
import { ProductForm } from '../../components/product-form';
import { fetchBrands, fetchCategories, fetchProduct } from '../../lib/api';

export const metadata: Metadata = { title: 'Edit product' };
export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [productResult, categoryResult, brandResult] = await Promise.all([fetchProduct(id), fetchCategories(), fetchBrands()]);
  if (!productResult.ok) return <ApiNotice message={productResult.error} />;
  if (!categoryResult.ok) return <ApiNotice message={categoryResult.error} />;
  if (!brandResult.ok) return <ApiNotice message={brandResult.error} />;
  const product = productResult.data;
  return <>
    <section className="page-heading"><div><p className="eyebrow">Product detail</p><h1>{product.name}</h1><p>Edit catalogue, pricing and compliance fields for {product.sku}.</p></div><div className="heading-actions"><Link className="button button-muted" href="/products">Back</Link><form action={archiveProduct}><input type="hidden" name="id" value={product.id} /><ConfirmSubmitButton className="button button-danger" message={`Archive ${product.name}? It will disappear from the storefront.`}>Archive product</ConfirmSubmitButton></form></div></section>
    <ActionMessage success={query.success} error={query.error} />
    <ProductForm action={updateProduct} categories={categoryResult.data.items} brands={brandResult.data.items} product={product} submitLabel="Save product" />
  </>;
}
