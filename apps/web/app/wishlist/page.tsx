'use client';
/* eslint-disable local/no-jsx-literals -- Storefront account copy is currently English-only. */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { browserApi, money } from '../../lib/store-api';

interface WishlistItem {
  id: string;
  productId: string;
  available: boolean;
  product: null | {
    id: string;
    slug: string;
    name: string;
    priceMinor: string;
    currency: string;
    isAlcohol: boolean;
    imageUrl?: string | null;
  };
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = useCallback(
    () =>
      browserApi<{ items: WishlistItem[] }>('/api/v1/wishlist')
        .then((data) => {
          setItems(data.items);
          setError('');
        })
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : 'Could not load wishlist');
        }),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function remove(productId: string) {
    setBusyId(productId);
    try {
      await browserApi(`/api/v1/wishlist/items/${productId}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusyId('');
    }
  }
  async function move(productId: string) {
    setBusyId(productId);
    try {
      await browserApi(`/api/v1/wishlist/items/${productId}/move-to-cart`, {
        method: 'POST',
        body: JSON.stringify({ quantity: 1 }),
      });
      await load();
    } finally {
      setBusyId('');
    }
  }
  if (error)
    return (
      <main className="account-page account-page-narrow">
        <div className="empty-state account-empty">
          <h1>Sign in to view your wishlist</h1>
          <p>{error}</p>
          <Link className="button" href="/auth/login">
            Sign in
          </Link>
        </div>
      </main>
    );

  return (
    <main className="account-page">
      <header className="account-page-header">
        <div>
          <p className="eyebrow">Saved for later</p>
          <h1>My wishlist</h1>
          <p>Keep your favourites together and move them to your basket when you are ready.</p>
        </div>
        <Link className="button secondary" href="/search">
          Continue shopping
        </Link>
      </header>
      {items === null ? (
        <div className="skeleton">Loading wishlist…</div>
      ) : items.length === 0 ? (
        <div className="empty-state account-empty">
          <span className="empty-state-icon" aria-hidden="true">
            ♡
          </span>
          <h2>Your wishlist is empty</h2>
          <p>Save products you love and they will appear here.</p>
          <Link className="button" href="/search">
            Browse products
          </Link>
        </div>
      ) : (
        <section className="wishlist-panel" aria-label="Saved products">
          <div className="wishlist-summary">
            <strong>
              {items.length} {items.length === 1 ? 'saved item' : 'saved items'}
            </strong>
            <span>Prices and availability are checked live</span>
          </div>
          <div className="wishlist-grid">
            {items.map((item) => {
              const product = item.product;
              const href = product ? `/product/${product.slug || product.id}` : '#';
              return (
                <article className="wishlist-card" key={item.id}>
                  <Link
                    className={`wishlist-art${product?.imageUrl ? ' has-image' : ''}`}
                    href={href}
                    style={
                      product?.imageUrl
                        ? { backgroundImage: `url(${product.imageUrl})` }
                        : undefined
                    }
                  >
                    {!product?.imageUrl && (
                      <span>{product?.isAlcohol ? '18+' : (product?.name.slice(0, 1) ?? '×')}</span>
                    )}
                  </Link>
                  <div className="wishlist-copy">
                    <div>
                      <span className={`stock-label${item.available ? '' : ' unavailable'}`}>
                        {item.available ? 'In stock' : 'Unavailable'}
                      </span>
                      <h2>
                        <Link href={href}>{product?.name ?? 'Unavailable product'}</Link>
                      </h2>
                    </div>
                    {product && (
                      <p className="price">{money(product.priceMinor, product.currency)}</p>
                    )}
                    <div className="wishlist-actions">
                      <button
                        className="button"
                        disabled={!item.available || busyId === item.productId}
                        onClick={() => void move(item.productId)}
                      >
                        {busyId === item.productId ? 'Updating…' : 'Move to basket'}
                      </button>
                      <button
                        className="text-button"
                        disabled={busyId === item.productId}
                        onClick={() => void remove(item.productId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
