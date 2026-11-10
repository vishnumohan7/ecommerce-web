/* eslint-disable local/no-jsx-literals -- Storefront copy is currently English-only. */
'use client';

import { useState } from 'react';

interface GalleryImage {
  id: string;
  url: string;
  altText: string;
}

export function ProductGallery({
  images,
  productName,
  onOffer,
}: Readonly<{ images: GalleryImage[]; productName: string; onOffer: boolean }>) {
  const [selected, setSelected] = useState(0);
  const current = images[selected];

  return (
    <div className="pdp-media">
      <div
        className={`pdp-art${current ? ' has-image' : ''}`}
        style={current ? { backgroundImage: `url(${current.url})` } : undefined}
        role="img"
        aria-label={current?.altText || productName}
      >
        {onOffer && <span className="pdp-sale-badge">On sale</span>}
        <span className="pdp-wishlist" aria-hidden="true">
          ♡
        </span>
        {!current && <b>{productName.slice(0, 1)}</b>}
        {current && <small>⌕ Roll to zoom</small>}
      </div>
      {images.length > 0 && (
        <div className="pdp-thumbnails">
          {images.slice(0, 5).map((image, index) => (
            <button
              className={index === selected ? 'active' : ''}
              key={image.id}
              onClick={() => {
                setSelected(index);
              }}
              style={{ backgroundImage: `url(${image.url})` }}
              aria-label={`View ${image.altText || productName}`}
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  );
}
