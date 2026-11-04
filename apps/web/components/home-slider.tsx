'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export interface HomeSlide {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  mobileImageUrl?: string | null;
  linkUrl?: string | null;
}

export function HomeSlider({ slides }: Readonly<{ slides: HomeSlide[] }>) {
  const fallback: HomeSlide = {
    id: 'fallback',
    title: 'Fresh groceries for every table',
    subtitle: 'Quality produce, pantry essentials and drinks delivered with careful fulfilment.',
    imageUrl: '/images/demo-grocery-slider.png',
    linkUrl: '/category/all',
  };
  const items = slides.length ? slides : [fallback];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % items.length),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [items.length]);

  return (
    <section className="home-slider" aria-roledescription="carousel" aria-label="Store highlights">
      {items.map((slide, index) => (
        <article
          key={slide.id}
          className={`home-hero home-slide${index === active ? ' is-active' : ''}${slide.imageUrl ? ' has-image' : ''}`}
          aria-hidden={index !== active}
          style={
            slide.imageUrl
              ? {
                  backgroundImage: `linear-gradient(90deg, rgb(2 47 35 / 96%) 0%, rgb(2 47 35 / 76%) 42%, rgb(2 47 35 / 8%) 100%), url(${slide.imageUrl})`,
                }
              : undefined
          }
        >
          <div>
            <p className="hero-kicker">Authentic South Asian provisions</p>
            <h1>{slide.title}</h1>
            {slide.subtitle && <p>{slide.subtitle}</p>}
            <div className="hero-actions">
              <Link
                className="button gold"
                href={slide.linkUrl ?? '/category/all'}
                tabIndex={index === active ? 0 : -1}
              >
                Shop now →
              </Link>
              <Link
                className="button outline-light"
                href="/category/all"
                tabIndex={index === active ? 0 : -1}
              >
                Browse categories
              </Link>
            </div>
          </div>
        </article>
      ))}
      {items.length > 1 && (
        <div className="slider-controls" aria-label="Choose slide">
          {items.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={index === active ? 'is-active' : ''}
              onClick={() => setActive(index)}
              aria-label={`Show slide ${index + 1}`}
              aria-current={index === active ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
