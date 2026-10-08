import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddProduct } from './product-actions';
import { ProductGrid } from '../../../components/product-card';
import { money, productImage, serverApi, type Product } from '../../../lib/store-api';

export default async function ProductPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const product = await serverApi<Product>(`/api/v1/products/${encodeURIComponent(id)}`);
  if (!product) notFound();
  const [related, reviews] = await Promise.all([
    serverApi<Product[]>(`/api/v1/products?categoryId=${encodeURIComponent(product.categoryId)}&take=12`),
    serverApi<{ ratingAverageBps: number; ratingCount: number; items: Array<{ id: string; rating: number; title?: string | null; body: string; reviewer: string }> }>(`/api/v1/reviews?productId=${encodeURIComponent(product.id)}`),
  ]);
  const images = product.images?.filter((image) => /^https?:\/\//.test(image.url)) ?? [];
  const featured = productImage(product);

  return <main className="product-page">
    <div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><Link href="/category/all">Catalogue</Link><span>/</span><strong>{product.name}</strong></div>
    <section className="pdp">
      <div className="pdp-media"><div className={`pdp-art${featured ? ' has-image' : ''}`} style={featured ? { backgroundImage: `url(${featured})` } : undefined}>{!featured && <span>{product.isAlcohol ? '18+' : product.name.slice(0, 1)}</span>}</div>{images.length > 1 && <div className="pdp-thumbnails">{images.slice(0, 5).map((image) => <a href={image.url} key={image.id} style={{ backgroundImage: `url(${image.url})` }} aria-label={image.altText} />)}</div>}</div>
      <div className="pdp-copy"><div className="product-flags"><span>Authentic range</span><span>Secure UK checkout</span>{product.isAlcohol && <span className="restricted">18+</span>}</div><h1>{product.name}</h1><p className="pdp-rating">★ {(Number(product.ratingAverageBps ?? 0) / 100).toFixed(1)} <span>({product.ratingCount ?? 0} verified reviews)</span></p><p className="product-reference">SKU: <strong>{product.sku}</strong>{product.brandName && <> · Brand: <strong>{product.brandName}</strong></>}</p><div className="pdp-price-panel"><strong>{money(product.priceMinor, product.currency)}</strong>{product.unitPriceDisplay && <span>{product.unitPriceDisplay}</span>}</div>{product.variants?.length ? <div className="variant-list"><p>Select option</p>{product.variants.map((variant) => <span key={variant.id}><strong>{variant.name}</strong><small>{money(variant.priceMinor, product.currency)}{variant.packSize ? ` · ${variant.packSize}` : ''}</small></span>)}</div> : null}<AddProduct productId={product.id} />{product.isAlcohol && <div className="compliance-note"><strong>Challenge 25</strong><p>You must be 18 or over. Valid photo ID may be requested at delivery, and this item cannot be left unattended.</p></div>}<ul className="pdp-assurances"><li>Live stock and pricing</li><li>Secure payment processing</li><li>Order confirmation and downloadable invoice</li></ul></div>
    </section>
    <section className="product-information"><h2>Product description</h2><p>{product.description}</p><dl><div><dt>SKU</dt><dd>{product.sku}</dd></div><div><dt>Unit</dt><dd>{product.unitPriceDisplay ?? 'Each'}</dd></div>{product.isAlcohol && <div><dt>ABV</dt><dd>{product.abv}%</dd></div>}</dl></section>
    {reviews?.items.length ? <section className="review-section"><div className="section-heading"><h2>Customer reviews</h2><Link href="/reviews">Write a review</Link></div><div className="review-list">{reviews.items.slice(0, 3).map((review) => <article key={review.id}><strong>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong><h3>{review.title ?? 'Verified review'}</h3><p>{review.body}</p><small>{review.reviewer}</small></article>)}</div></section> : null}
    <section className="related-section"><div className="section-heading"><div><p className="eyebrow">Related products</p><h2>You may also like</h2></div></div><ProductGrid products={(related ?? []).filter((item) => item.id !== product.id).slice(0, 5)} /></section>
  </main>;
}
