'use client';

import { useState } from 'react';
import { browserApi } from '../lib/store-api';

interface WishlistButtonProps {
  productId: string;
  className?: string;
}

export function WishlistButton({ productId, className = '' }: Readonly<WishlistButtonProps>) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saved = status === 'saved';

  async function saveProduct() {
    if (status === 'saving' || saved) return;

    setStatus('saving');
    try {
      await browserApi('/api/v1/wishlist/items', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  const label = saved
    ? 'Added to saved favourites'
    : status === 'error'
      ? 'Could not add to saved favourites. Try again'
      : 'Add to saved favourites';

  return (
    <button
      type="button"
      className={`${className}${saved ? ' saved' : ''}${status === 'error' ? ' error' : ''}`}
      onClick={() => void saveProduct()}
      disabled={status === 'saving'}
      aria-label={label}
      aria-pressed={saved}
      title={label}
    >
      <span aria-hidden="true">{saved ? '\u2665' : '\u2661'}</span>
    </button>
  );
}
