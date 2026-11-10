/* eslint-disable local/no-jsx-literals -- Storefront copy is currently English-only. */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddBundle, AddProduct } from './product-actions';
import { ProductGallery } from './product-gallery';
import { ProductGrid } from '../../../components/product-card';
import { money, productImage, serverApi, type Product } from '../../../lib/store-api';

interface SearchResult {
  items: Array<{ id: string; inStock: boolean; onOffer: boolean }>;
}

export default async function ProductPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const product = await serverApi<Product>(`/api/v1/products/${encodeURIComponent(id)}`);
  if (!product) notFound();

  const [related, reviews, availability] = await Promise.all([
    serverApi<Product[]>(
      `/api/v1/products?categoryId=${encodeURIComponent(product.categoryId)}&take=12`,
    ),
    serverApi<{
      ratingAverageBps: number;
      ratingCount: number;
      items: Array<{
        id: string;
        rating: number;
        title?: string | null;
        body: string;
        reviewer: string;
      }>;
    }>(`/api/v1/reviews?productId=${encodeURIComponent(product.id)}`),
    serverApi<SearchResult>(`/api/v1/search?q=${encodeURIComponent(product.sku)}&limit=10`),
  ]);
  const liveStatus = availability?.items.find((item) => item.id === product.id);
  const gallery = product.images?.filter((image) => /^https?:\/\//.test(image.url)) ?? [];
  const relatedProducts = (related ?? []).filter((item) => item.id !== product.id);
  const bundleProducts = [product, ...relatedProducts.slice(0, 2)];
  const bundleTotal = bundleProducts.reduce((total, item) => total + Number(item.priceMinor), 0);
  const rating = (product.ratingAverageBps ?? reviews?.ratingAverageBps ?? 0) / 100;
  const ratingCount = product.ratingCount ?? reviews?.ratingCount ?? 0;

  return (
    <main className="product-page">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/category/all">Catalogue</Link>
        <span>/</span>
        <strong>{product.name}</strong>
      </div>
      <section className="pdp">
        <ProductGallery
          images={gallery}
          productName={product.name}
          onOffer={Boolean(liveStatus?.onOffer)}
        />
        <div className="pdp-copy">
          <div className="product-flags">
            <span>◉ Authentic product</span>
            <span>▣ Tracked UK delivery</span>
            {product.countryOfOrigin && (
              <span className="origin">✺ Sourced in {product.countryOfOrigin}</span>
            )}
            {product.isAlcohol && <span className="restricted">18+ · Challenge 25</span>}
          </div>
          <h1>{product.name}</h1>
          <p className="pdp-rating">
            {'★'.repeat(Math.max(0, Math.min(5, Math.round(rating))))}
            {'☆'.repeat(Math.max(0, 5 - Math.round(rating)))}
            <Link href="#reviews">
              {rating.toFixed(1)} ({ratingCount} verified reviews)
            </Link>
          </p>
          <p className="product-reference">
            {product.brandName && (
              <>
                Brand: <strong>{product.brandName}</strong>
                <b>•</b>
              </>
            )}
            SKU: <strong>{product.sku}</strong>
            {product.countryOfOrigin && (
              <>
                <b>•</b>Origin: <strong>{product.countryOfOrigin}</strong>
              </>
            )}
          </p>
          <div className="pdp-price-panel">
            <div>
              <strong>{money(product.priceMinor, product.currency)}</strong>
              {liveStatus?.onOffer && <span className="offer-label">On offer</span>}
              <small>
                Unit price: {product.unitPriceDisplay ?? 'Each'} · VAT included where applicable
              </small>
            </div>
            <div className={`stock-pill ${liveStatus?.inStock === false ? 'out' : ''}`}>
              <strong>● {liveStatus?.inStock === false ? 'Out of stock' : 'In stock'}</strong>
              <small>Live catalogue availability</small>
            </div>
          </div>
          {product.variants?.length ? (
            <div className="variant-list">
              <div className="variant-heading">
                <strong>Select pack size</strong>
                <span>Choose the size that suits your order</span>
              </div>
              <div className="variant-option">
                <strong>{product.name}</strong>
                <small>{money(product.priceMinor, product.currency)} · Base product</small>
              </div>
              {product.variants
                .filter((variant) => variant.id)
                .map((variant, index) => (
                  <div
                    className={index === 0 ? 'variant-option selected' : 'variant-option'}
                    key={variant.id}
                  >
                    <strong>{variant.name}</strong>
                    <small>
                      {money(variant.priceMinor, product.currency)}
                      {variant.packSize ? ` · ${variant.packSize}` : ''}
                    </small>
                  </div>
                ))}
            </div>
          ) : null}
          <AddProduct productId={product.id} />
          {product.isAlcohol && (
            <div className="compliance-note">
              <strong>Challenge 25</strong>
              <p>
                You must be 18 or over. Valid photo ID may be requested at delivery, and this item
                cannot be left unattended.
              </p>
            </div>
          )}
          <ul className="pdp-assurances">
            <li>
              <strong>Order confirmation:</strong> Secure checkout with a downloadable invoice.
            </li>
            <li>
              <strong>Careful fulfilment:</strong> Products are packed according to their storage
              requirements.
            </li>
            <li>
              <strong>London delivery:</strong> Delivery charges and dates are confirmed at
              checkout.
            </li>
          </ul>
        </div>
      </section>

      {bundleProducts.length > 1 && (
        <section className="frequently-bought">
          <div className="bundle-title">
            <h2>🪄 Frequently bought together</h2>
            <span>Complete your basket</span>
          </div>
          <div className="bundle-products">
            {bundleProducts.map((item, index) => {
              const image = productImage(item);
              return (
                <article key={item.id}>
                  <div
                    className="bundle-image"
                    style={image ? { backgroundImage: `url(${image})` } : undefined}
                  >
                    {!image && item.name.slice(0, 1)}
                  </div>
                  <div>
                    <small>{index === 0 ? 'Main item' : 'Recommended'}</small>
                    <strong>{item.name}</strong>
                    <b>{money(item.priceMinor, item.currency)}</b>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="bundle-total">
            <small>Bundle price for all {bundleProducts.length}</small>
            <strong>{money(bundleTotal, product.currency)}</strong>
          </div>
          <AddBundle productIds={bundleProducts.map((item) => item.id)} />
        </section>
      )}

      <section className="product-information">
        <h2>Product description</h2>
        <p>{product.description}</p>
        <dl>
          <div>
            <dt>SKU</dt>
            <dd>{product.sku}</dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>{product.unitPriceDisplay ?? 'Each'}</dd>
          </div>
          {product.storageType && (
            <div>
              <dt>Storage</dt>
              <dd>{product.storageType}</dd>
            </div>
          )}
          {product.isAlcohol && (
            <div>
              <dt>ABV</dt>
              <dd>{product.abv}%</dd>
            </div>
          )}
        </dl>
      </section>
      {reviews?.items.length ? (
        <section className="review-section" id="reviews">
          <div className="section-heading">
            <h2>Customer reviews</h2>
            <Link href="/reviews">Write a review</Link>
          </div>
          <div className="review-list">
            {reviews.items.slice(0, 3).map((review) => (
              <article key={review.id}>
                <strong>
                  {'★'.repeat(review.rating)}
                  {'☆'.repeat(5 - review.rating)}
                </strong>
                <h3>{review.title ?? 'Verified review'}</h3>
                <p>{review.body}</p>
                <small>{review.reviewer}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <section className="related-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Related products</p>
            <h2>You may also like</h2>
          </div>
        </div>
        <ProductGrid products={relatedProducts.slice(0, 5)} />
      </section>
    </main>
  );
}
