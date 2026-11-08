'use client';

/* eslint-disable local/no-jsx-literals */
import Link from 'next/link';
import { useRef } from 'react';
import type { Category } from '../lib/store-api';

export function CategoryCarousel({ categories }: Readonly<{ categories: Category[] }>) {
  const track = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    track.current?.scrollBy({
      left: direction * track.current.clientWidth,
      behavior: 'smooth',
    });
  }

  return (
    <div className="category-carousel">
      <button
        type="button"
        onClick={() => {
          move(-1);
        }}
        aria-label="Previous categories"
      >
        ‹
      </button>
      <div className="category-orbits" ref={track}>
        {categories.map((category) => (
          <Link key={category.id} href={`/category/${category.slug}?id=${category.id}`}>
            <span
              style={
                category.imageUrl ? { backgroundImage: `url(${category.imageUrl})` } : undefined
              }
            >
              {!category.imageUrl && category.name.slice(0, 1)}
            </span>
            <strong>{category.name}</strong>
          </Link>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          move(1);
        }}
        aria-label="Next categories"
      >
        ›
      </button>
    </div>
  );
}
