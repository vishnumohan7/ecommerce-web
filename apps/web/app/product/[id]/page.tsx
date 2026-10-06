import { notFound } from 'next/navigation';
import { AddProduct } from './product-actions';
import { ProductGrid } from '../../../components/product-card';
import { money, serverApi, type Product } from '../../../lib/store-api';

export default async function ProductPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const product = await serverApi<Product>(`/api/v1/products/${encodeURIComponent(id)}`);
  if (!product) notFound();
  const [related, reviews] = await Promise.all([serverApi<Product[]>(`/api/v1/products?categoryId=${encodeURIComponent(product.categoryId)}`), serverApi<{ ratingAverageBps: number; ratingCount: number; items: Array<{ id: string; rating: number; title?: string | null; body: string; reviewer: string }> }>(`/api/v1/reviews?productId=${encodeURIComponent(product.id)}`)]);
  return <main className="section"><div className="pdp"><div className="pdp-art"><span>{product.isAlcohol ? '18+' : product.name.slice(0, 1)}</span></div><div><p className="eyebrow">{product.sku}</p><h1>{product.name}</h1><p className="lede">{product.description}</p><p className="pdp-price">{money(product.priceMinor, product.currency)}</p>{product.unitPriceDisplay && <p className="unit-price">{product.unitPriceDisplay}</p>}{product.isAlcohol && <div className="compliance-note"><strong>Challenge 25</strong><p>You must be 18 or over. Valid photo ID may be requested at your door; this item cannot be left unattended.</p></div>}<AddProduct productId={product.id} /></div></div><section><div className="section-heading"><h2>Customer reviews</h2><a href="/reviews">Write a review</a></div>{reviews?.items.length ? <div className="review-list">{reviews.items.map((review) => <article key={review.id}><strong>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong><h3>{review.title ?? 'Verified review'}</h3><p>{review.body}</p><small>{review.reviewer}</small></article>)}</div> : <div className="empty-state">No approved reviews yet.</div>}</section><div className="section-heading"><h2>You may also like</h2></div><ProductGrid products={(related ?? []).filter((item) => item.id !== product.id).slice(0, 4)} /></main>;
}
