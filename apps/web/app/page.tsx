/* eslint-disable local/no-jsx-literals */
import Link from 'next/link';
import { ProductGrid } from '../components/product-card';
import { HomeSlider, type HomeSlide } from '../components/home-slider';
import { CategoryCarousel } from '../components/category-carousel';
import { serverApi, type Category, type Product } from '../lib/store-api';

interface HomeContent {
  banners: HomeSlide[];
  blocks: Array<{
    id: string;
    type: string;
    title?: string | null;
    content: unknown;
    products?: Product[];
  }>;
}

interface PromoCard {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  linkUrl: string;
  imageUrl?: string;
  tone: 'fresh' | 'pantry' | 'drinks';
}

const fallbackPromoCards: PromoCard[] = [
  {
    id: 'fresh',
    eyebrow: 'Chilled selection',
    title: 'Fresh food',
    description: 'Browse chilled and fresh products available from the live catalogue.',
    buttonLabel: 'Shop fresh food →',
    linkUrl: '/category/fresh-food',
    tone: 'fresh',
  },
  {
    id: 'pantry',
    eyebrow: 'Pantry essentials',
    title: 'Groceries',
    description: 'Rice, grains, spices, snacks and everyday household favourites.',
    buttonLabel: 'Shop groceries →',
    linkUrl: '/category/all',
    tone: 'pantry',
  },
  {
    id: 'drinks',
    eyebrow: '18+ · drink responsibly',
    title: 'Drinks',
    description: 'Age-gated browsing and Challenge 25 controls at delivery.',
    buttonLabel: 'Browse drinks →',
    linkUrl: '/alcohol',
    tone: 'drinks',
  },
];

export default async function Home({
  searchParams,
}: Readonly<{ searchParams: Promise<{ ageGate?: string }> }>) {
  const [{ ageGate }, products, categories, content] = await Promise.all([
    searchParams,
    serverApi<Product[]>('/api/v1/products?take=24'),
    serverApi<{ items: Category[] }>('/api/v1/categories?limit=12'),
    serverApi<HomeContent>('/api/v1/content/home'),
  ]);
  const configuredPromoCards = (content?.blocks ?? [])
    .filter((block) => block.type === 'PROMO_BLOCK')
    .map(promoCardFromBlock)
    .filter((card): card is PromoCard => card !== null);
  const promoCards = configuredPromoCards.length ? configuredPromoCards : fallbackPromoCards;
  const configuredProductRows = (content?.blocks ?? []).filter(
    (block) => block.type === 'FEATURED_PRODUCTS',
  );
  const productRows = configuredProductRows.length
    ? configuredProductRows
    : [
        {
          id: 'featured-products',
          type: 'FEATURED_PRODUCTS',
          title: 'Featured products',
          content: { eyebrow: 'From the live catalogue', linkUrl: '/search' },
          products: products?.slice(0, 12) ?? [],
        },
      ];
  const remainingBlocks = (content?.blocks ?? []).filter(
    (block) => block.type !== 'PROMO_BLOCK' && block.type !== 'FEATURED_PRODUCTS',
  );
  return (
    <main className="storefront-home">
      {ageGate === 'declined' && (
        <aside className="gate-notice" role="status">
          Alcohol browsing was closed. <Link href="/">Dismiss</Link>
        </aside>
      )}
      <HomeSlider slides={content?.banners ?? []} />
      <section className="home-section category-section">
        <div className="section-heading">
          <div>
            <h2>Explore everyday essentials</h2>
            <p>Shop the live catalogue by category</p>
          </div>
          <Link href="/category/all">View all →</Link>
        </div>
        <CategoryCarousel categories={categories?.items ?? []} />
      </section>
      <section className="home-section story-grid">
        {promoCards.map((card) => (
          <Link
            key={card.id}
            href={card.linkUrl}
            className={`story-card ${card.tone}`}
            style={
              card.imageUrl
                ? { backgroundImage: `${cardGradient(card.tone)}, url(${card.imageUrl})` }
                : undefined
            }
          >
            <small>{card.eyebrow}</small>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <b>{card.buttonLabel}</b>
          </Link>
        ))}
      </section>
      {productRows.map((row) => {
        const rowContent = objectContent(row.content);
        const rowProducts = row.products ?? [];
        return (
          <section className="home-section" key={row.id}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{textContent(rowContent.eyebrow) || 'Curated products'}</p>
                <h2>{row.title || 'Products'}</h2>
              </div>
              <Link href={textContent(rowContent.linkUrl) || '/category/all'}>View all →</Link>
            </div>
            {rowProducts.length ? (
              <ProductGrid products={rowProducts} />
            ) : (
              <div className="empty-product-row">Products will appear here when available.</div>
            )}
          </section>
        );
      })}
      {remainingBlocks.length ? (
        <section className="home-section cms-blocks">
          {remainingBlocks.slice(0, 2).map((block) => (
            <article key={block.id}>
              <p className="eyebrow">{block.type.replaceAll('_', ' ')}</p>
              {block.title && <h2>{block.title}</h2>}
              <CmsBody content={block.content} />
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function promoCardFromBlock(block: HomeContent['blocks'][number]): PromoCard | null {
  if (!block.title || !block.content || typeof block.content !== 'object') return null;
  const content = block.content as Record<string, unknown>;
  const read = (key: string) => (typeof content[key] === 'string' ? content[key] : '');
  const tone = read('tone');
  const imageUrl = read('imageUrl');
  return {
    id: block.id,
    eyebrow: read('eyebrow'),
    title: block.title,
    description: read('description'),
    buttonLabel: read('buttonLabel') || 'Shop now →',
    linkUrl: read('linkUrl') || '/category/all',
    ...(imageUrl ? { imageUrl } : {}),
    tone: tone === 'pantry' || tone === 'drinks' ? tone : 'fresh',
  };
}

function cardGradient(tone: PromoCard['tone']) {
  if (tone === 'drinks') return 'linear-gradient(90deg, rgba(54,17,20,.96), rgba(31,41,36,.35))';
  if (tone === 'pantry') return 'linear-gradient(90deg, rgba(67,57,31,.96), rgba(33,58,45,.35))';
  return 'linear-gradient(90deg, rgba(6,56,43,.97), rgba(6,56,43,.28))';
}

function CmsBody({ content }: Readonly<{ content: unknown }>) {
  if (typeof content === 'string') return <p>{content}</p>;
  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    const text = [record.description, record.text, record.body].find(
      (value) => typeof value === 'string',
    );
    if (typeof text === 'string') return <p>{text}</p>;
  }
  return null;
}

function objectContent(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textContent(value: unknown) {
  return typeof value === 'string' ? value : '';
}
