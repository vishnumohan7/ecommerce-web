'use client';

/* eslint-disable local/no-jsx-literals */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { basketChangedEvent } from '../lib/basket-events';
import { browserApi, money, type Category } from '../lib/store-api';

interface BasketItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  currentPriceMinor: string;
  lineTotalMinor: string;
  imageUrl?: string | null;
}

interface BasketHeader {
  currency: string;
  groups: Array<{ items: BasketItem[] }>;
  totals: { subtotalMinor: string; grandTotalMinor: string };
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  const [basket, setBasket] = useState<BasketHeader | null>(null);
  const [basketError, setBasketError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  const refreshBasket = useCallback(async () => {
    try {
      setBasket(await browserApi<BasketHeader>('/api/v1/cart'));
      setBasketError('');
    } catch (error) {
      setBasketError(error instanceof Error ? error.message : 'Basket unavailable');
    }
  }, []);

  const basketItems = basket?.groups.flatMap((group) => group.items) ?? [];
  const basketCount = basketItems.reduce((total, item) => total + item.quantity, 0);

  async function changeBasketItem(item: BasketItem, quantity: number) {
    try {
      const updated = await browserApi<BasketHeader>(
        `/api/v1/cart/items/${item.id}`,
        quantity < 1
          ? { method: 'DELETE' }
          : { method: 'PATCH', body: JSON.stringify({ quantity }) },
      );
      setBasket(updated);
      setBasketError('');
    } catch (error) {
      setBasketError(error instanceof Error ? error.message : 'Could not update basket');
    }
  }

  useEffect(() => {
    const handleBasketChange = () => {
      void refreshBasket();
      setBasketOpen(true);
    };
    const handleFocus = () => {
      void refreshBasket();
    };

    void refreshBasket();
    window.addEventListener(basketChangedEvent, handleBasketChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener(basketChangedEvent, handleBasketChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshBasket]);

  useEffect(() => {
    if (!basketOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBasketOpen(false);
    };
    document.body.classList.add('basket-drawer-visible');
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.classList.remove('basket-drawer-visible');
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [basketOpen]);

  useEffect(() => {
    void browserApi<{ items: Category[] }>('/api/v1/categories?limit=50')
      .then((result) => {
        setCategories(result.items);
      })
      .catch(() => undefined);
  }, []);

  return (
    <>
      <div className="utility-strip">
        <div>
          <span>
            <i aria-hidden="true">▣</i> UK Wide Delivery
          </span>
          <span>
            <i aria-hidden="true">♧</i> Free Grocery Delivery on orders over £40
          </span>
          <span>
            <i aria-hidden="true">ϟ</i> Chilled / Frozen Packing Fee £1.99
          </span>
          <span>
            <i aria-hidden="true">▰</i> Alcohol Delivery £5.99 (Weekdays)
          </span>
        </div>
        <nav aria-label="Help links">
          <Link href="/help/contact">Help &amp; FAQ</Link>
          <span aria-hidden="true">•</span>
          <Link href="/orders">Track Order</Link>
        </nav>
      </div>
      <header className="site-header">
        <button
          className="menu-button"
          type="button"
          onClick={() => {
            setOpen((value) => !value);
          }}
          aria-expanded={open}
          aria-label="Open categories"
        >
          ☰
        </button>
        <Link className="brand" href="/" aria-label="Angadi home">
          <span aria-hidden="true" />
          <strong>ANGADI</strong>
          <small>Kerala &amp; Indian groceries · drinks</small>
        </Link>
        <form className="header-search" action="/search">
          <label className="sr-only" htmlFor="site-search">
            Search products
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search matta rice, curry leaves, beef roast masala, old monk…"
          />
          <button type="submit" aria-label="Search">
            ⌕
          </button>
        </form>
        <nav className="account-nav" aria-label="Account and basket">
          <Link href="/profile">
            <span className="account-icon" aria-hidden="true">
              ♙
            </span>
            <small>Namaskaram</small>
            <strong>Account</strong>
          </Link>
          <button
            className="cart-link"
            type="button"
            onClick={() => {
              setBasketOpen(true);
            }}
            aria-expanded={basketOpen}
            aria-controls="basket-drawer"
          >
            <span className="basket-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M5.5 9.5h13l-1.1 9H6.6l-1.1-9Z" />
                <path d="m8.5 9.5 3.5-5 3.5 5M9 12.5v3.5m3-3.5v3.5m3-3.5v3.5" />
              </svg>
              {basketCount > 0 && <b>{basketCount > 99 ? '99+' : basketCount}</b>}
            </span>
            <small>Basket</small>
            <strong>{money(basket?.totals.grandTotalMinor ?? 0, basket?.currency)}</strong>
          </button>
        </nav>
      </header>
      <nav className={`category-nav ${open ? 'open' : ''}`} aria-label="Main navigation">
        <details className="categories-menu">
          <summary className="all-categories">
            <span aria-hidden="true">☰</span> All categories{' '}
            <span className="menu-chevron" aria-hidden="true">
              ⌄
            </span>
          </summary>
          <div className="categories-dropdown">
            {categories.map((category) => (
              <Link key={category.id} href={`/category/${category.slug}?id=${category.id}`}>
                {category.imageUrl ? (
                  <span
                    className="category-thumb"
                    style={{ backgroundImage: `url(${category.imageUrl})` }}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="category-initial" aria-hidden="true">
                    {category.name.slice(0, 1)}
                  </span>
                )}
                {category.name}
              </Link>
            ))}
            <Link className="view-all-categories" href="/category/all">
              <span className="category-initial" aria-hidden="true">
                ▦
              </span>
              View all categories
            </Link>
          </div>
        </details>
        <Link
          className={pathname === '/category/groceries' ? 'active' : undefined}
          href="/category/groceries"
        >
          Groceries
        </Link>
        <Link
          className={pathname === '/category/fresh-food' ? 'active' : undefined}
          href="/category/fresh-food"
        >
          Fresh Food
        </Link>
        <Link
          className={pathname === '/category/frozen' ? 'active' : undefined}
          href="/category/frozen"
        >
          Frozen
        </Link>
        <Link
          className={pathname === '/category/rice-grains' ? 'active' : undefined}
          href="/category/rice-grains"
        >
          Rice &amp; Grains
        </Link>
        <Link
          className={pathname === '/category/spices' ? 'active' : undefined}
          href="/category/spices"
        >
          Spices
        </Link>
        <Link
          className={pathname === '/category/snacks' ? 'active' : undefined}
          href="/category/snacks"
        >
          Snacks
        </Link>
        <Link
          className={pathname === '/category/beverages' ? 'active' : undefined}
          href="/category/beverages"
        >
          Beverages
        </Link>
        <Link className={pathname === '/alcohol' ? 'active' : undefined} href="/alcohol">
          Alcohol
        </Link>
        <Link className="offers-link" href="/offers">
          Offers
        </Link>
      </nav>
      <button
        className={`basket-backdrop${basketOpen ? ' open' : ''}`}
        type="button"
        aria-label="Close basket"
        onClick={() => {
          setBasketOpen(false);
        }}
      />
      <aside
        id="basket-drawer"
        className={`basket-drawer${basketOpen ? ' open' : ''}`}
        aria-hidden={!basketOpen}
        aria-label="Your basket"
      >
        <header>
          <div>
            <p>Your basket</p>
            <span>
              {basketCount} {basketCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setBasketOpen(false);
            }}
            aria-label="Close basket"
          >
            ×
          </button>
        </header>
        {basketError && (
          <p className="basket-drawer-error" role="alert">
            {basketError}
          </p>
        )}
        {basketItems.length > 0 ? (
          <>
            <div className="basket-delivery-progress">
              {(() => {
                const subtotal = Number(basket?.totals.subtotalMinor ?? 0);
                const remaining = Math.max(0, 4000 - subtotal);
                return (
                  <>
                    <strong>
                      {remaining > 0
                        ? `${money(remaining, basket?.currency)} away from free delivery`
                        : 'Free delivery unlocked'}
                    </strong>
                    <span>
                      <i style={{ width: `${String(Math.min(100, subtotal / 40))}%` }} />
                    </span>
                    <small>Free grocery delivery on qualifying orders over £40</small>
                  </>
                );
              })()}
            </div>
            <div className="basket-drawer-items">
              {basketItems.map((item) => (
                <article key={item.id}>
                  <Link
                    className={`basket-drawer-image${item.imageUrl ? ' has-image' : ''}`}
                    href={`/product/${item.productId}`}
                    style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
                    onClick={() => {
                      setBasketOpen(false);
                    }}
                  >
                    {!item.imageUrl && item.name.slice(0, 1)}
                  </Link>
                  <div>
                    <Link
                      href={`/product/${item.productId}`}
                      onClick={() => {
                        setBasketOpen(false);
                      }}
                    >
                      {item.name}
                    </Link>
                    <small>{money(item.currentPriceMinor, basket?.currency)} each</small>
                    <div className="basket-drawer-quantity">
                      <button
                        type="button"
                        onClick={() => void changeBasketItem(item, item.quantity - 1)}
                        aria-label={`Reduce ${item.name}`}
                      >
                        −
                      </button>
                      <output>{item.quantity}</output>
                      <button
                        type="button"
                        onClick={() => void changeBasketItem(item, item.quantity + 1)}
                        aria-label={`Add another ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="basket-drawer-line-total">
                    <button
                      type="button"
                      onClick={() => void changeBasketItem(item, 0)}
                      aria-label={`Remove ${item.name}`}
                    >
                      ×
                    </button>
                    <strong>{money(item.lineTotalMinor, basket?.currency)}</strong>
                  </div>
                </article>
              ))}
            </div>
            <footer>
              <div>
                <span>Total</span>
                <strong>{money(basket?.totals.grandTotalMinor ?? 0, basket?.currency)}</strong>
              </div>
              <Link
                className="button full"
                href="/checkout"
                onClick={() => {
                  setBasketOpen(false);
                }}
              >
                Checkout · {money(basket?.totals.grandTotalMinor ?? 0, basket?.currency)}
              </Link>
              <Link
                href="/cart"
                onClick={() => {
                  setBasketOpen(false);
                }}
              >
                View and edit basket
              </Link>
            </footer>
          </>
        ) : (
          <div className="basket-drawer-empty">
            <span aria-hidden="true">🛒</span>
            <h2>Your basket is empty</h2>
            <p>Add products and they will appear here.</p>
            <Link
              className="button"
              href="/category/all"
              onClick={() => {
                setBasketOpen(false);
              }}
            >
              Start shopping
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
