'use client';

import Link from 'next/link';
import { useState } from 'react';
import { notifyBasketChanged } from '../lib/basket-events';
import { browserApi, money, productImage, type Product } from '../lib/store-api';
import { WishlistButton } from './wishlist-button';

export function ProductCard({ product }: Readonly<{ product: Product }>) {
  const [state, setState] = useState('');
  const image = productImage(product);

  async function add() {
    setState('Adding…');
    try {
      await browserApi('/api/v1/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      notifyBasketChanged();
      setState('Added');
    } catch (error) {
      setState(error instanceof Error ? error.message : 'Could not add');
    }
  }

  return (
    <article className="product-card">
      <div
        className={`product-art${image ? ' has-image' : ''}`}
        style={image ? { backgroundImage: `url(${image})` } : undefined}
      >
        <Link
          className="product-art-link"
          href={`/product/${product.id}`}
          aria-label={`View ${product.name}`}
        />
        <span className={product.isAlcohol ? 'age-pill' : 'category-pill'}>
          {product.isAlcohol ? '18+' : (product.categoryName ?? 'Grocery')}
        </span>
        <WishlistButton productId={product.id} className="save-mark" />
        {!image && <b>{product.name.slice(0, 1)}</b>}
      </div>
      <div className="product-copy">
        <p className="product-meta">{product.brandName ?? product.sku}</p>
        <h3>
          <Link href={`/product/${product.id}`}>{product.name}</Link>
        </h3>
        <p className="unit-price">{product.unitPriceDisplay || '\u00A0'}</p>
        <p className="price">{money(product.priceMinor, product.currency)}</p>
        <button
          className="button compact"
          onClick={() => void add()}
          disabled={state === 'Adding…'}
        >
          {state === 'Adding…' ? state : '+ Add to basket'}
        </button>
        {state && state !== 'Adding…' && <small role="status">{state}</small>}
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  empty = 'No products match this selection.',
  layout = 'grid',
}: Readonly<{ products: Product[]; empty?: string; layout?: 'grid' | 'list' }>) {
  if (!products.length)
    return (
      <div className="empty-state">
        <h2>{'Nothing here yet'}</h2>
        <p>{empty}</p>
      </div>
    );
  return (
    <div className={`product-grid${layout === 'list' ? ' product-grid-list' : ''}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
