/* eslint-disable local/no-jsx-literals -- Storefront copy is currently English-only. */
'use client';

import { useState } from 'react';
import { notifyBasketChanged } from '../../../lib/basket-events';
import { browserApi } from '../../../lib/store-api';

export function AddProduct({ productId }: Readonly<{ productId: string }>) {
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');

  async function add(redirect = false) {
    setMessage('Adding…');
    try {
      await browserApi('/api/v1/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      });
      notifyBasketChanged();
      if (redirect) window.location.assign('/cart');
      else setMessage('Added to your basket.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add');
    }
  }

  return (
    <div className="pdp-purchase">
      <div className="quantity">
        <button
          type="button"
          onClick={() => {
            setQuantity(Math.max(1, quantity - 1));
          }}
          aria-label="Reduce quantity"
        >
          −
        </button>
        <output>{quantity}</output>
        <button
          type="button"
          onClick={() => {
            setQuantity(quantity + 1);
          }}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <button className="button pdp-add" type="button" onClick={() => void add()}>
        🛒 Add to basket
      </button>
      <button className="button pdp-buy" type="button" onClick={() => void add(true)}>
        Buy now
      </button>
      {message && <span role="status">{message}</span>}
    </div>
  );
}

export function AddBundle({ productIds }: Readonly<{ productIds: string[] }>) {
  const [message, setMessage] = useState('');
  async function addAll() {
    setMessage('Adding…');
    try {
      for (const productId of productIds) {
        await browserApi('/api/v1/cart/items', {
          method: 'POST',
          body: JSON.stringify({ productId, quantity: 1 }),
        });
      }
      notifyBasketChanged();
      setMessage('Bundle added to your basket.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add bundle');
    }
  }
  return (
    <div className="bundle-action">
      <button className="button" type="button" onClick={() => void addAll()}>
        🛒 Add all to basket
      </button>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
