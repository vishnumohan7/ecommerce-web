'use client';

import Link from 'next/link';
import { useState } from 'react';
import { browserApi, money, type Product } from '../lib/store-api';

export function ProductCard({ product }: Readonly<{ product: Product }>) {
  const [state, setState] = useState('');
  async function add() {
    setState('Adding…');
    try {
      await browserApi('/api/v1/cart/items', { method: 'POST', body: JSON.stringify({ productId: product.id, quantity: 1 }) });
      setState('Added');
    } catch (error) { setState(error instanceof Error ? error.message : 'Could not add'); }
  }
  return (
    <article className="product-card">
      <Link className="product-art" href={`/product/${product.id}`} aria-label={product.name}>
        <span>{product.isAlcohol ? '18+' : product.name.slice(0, 1)}</span>
      </Link>
      <div className="product-copy">
        <p className="product-meta">{product.brandName ?? product.categoryName ?? product.sku}</p>
        <h3><Link href={`/product/${product.id}`}>{product.name}</Link></h3>
        <p className="price">{money(product.priceMinor, product.currency)}</p>
        {product.unitPriceDisplay && <p className="unit-price">{product.unitPriceDisplay}</p>}
        <button className="button compact" onClick={add} disabled={state === 'Adding…'}>{state || 'Add to basket'}</button>
        {state && state !== 'Adding…' && <small role="status">{state}</small>}
      </div>
    </article>
  );
}

export function ProductGrid({ products, empty = 'No products match this selection.' }: Readonly<{ products: Product[]; empty?: string }>) {
  if (!products.length) return <div className="empty-state"><h2>Nothing here yet</h2><p>{empty}</p></div>;
  return <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
