/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { createProduct } from '../../actions';
import { ActionMessage } from '../../components/action-message';
import { ApiNotice } from '../../components/api-notice';
import { ProductForm } from '../../components/product-form';
import { fetchBrands, fetchCategories, fetchWarehouses } from '../../lib/api';

export const metadata: Metadata = { title: 'Add product' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function NewProductPage({ searchParams }: Readonly<PageProps>) {
  const [query, categoryResult, brandResult, warehouseResult] = await Promise.all([
    searchParams,
    fetchCategories(),
    fetchBrands(),
    fetchWarehouses(),
  ]);
  if (!categoryResult.ok) return <ApiNotice message={categoryResult.error} />;
  if (!brandResult.ok) return <ApiNotice message={brandResult.error} />;
  if (!warehouseResult.ok) return <ApiNotice message={warehouseResult.error} />;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Catalogue & stock</p>
          <h1>Add product</h1>
          <p>Create the product, optional variants and warehouse opening stock in one workflow.</p>
        </div>
        <Link className="button button-muted" href="/products">
          Cancel
        </Link>
      </section>
      <ActionMessage success={query.success} error={query.error} />
      <ProductForm
        action={createProduct}
        categories={categoryResult.data.items}
        brands={brandResult.data.items}
        warehouses={warehouseResult.data}
        submitLabel="Create product"
      />
    </>
  );
}
