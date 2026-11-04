/* eslint-disable local/no-jsx-literals */
import Link from 'next/link';
import { ProductGrid } from '../components/product-card';
import { serverApi, type Category, type Product } from '../lib/store-api';

interface HomeContent {
  banners: Array<{
    id: string;
    title: string;
    subtitle?: string | null;
    imageUrl: string;
    linkUrl?: string | null;
  }>;
  blocks: Array<{ id: string; type: string; title?: string | null; content: unknown }>;
}

export default async function Home({
  searchParams,
}: Readonly<{ searchParams: Promise<{ ageGate?: string }> }>) {
  const [{ ageGate }, productsResult, categoriesResult, content] = await Promise.all([
    searchParams,
    serverApi<Product[]>('/api/v1/products?take=24'),
    serverApi<{ items: Category[] }>('/api/v1/categories?limit=12'),
    serverApi<HomeContent>('/api/v1/content/home'),
  ]);
  const products = productsResult ?? [];
  const categories = categoriesResult?.items ?? [];
  const banner = content?.banners[0];
  const categoryImage = (keywords: string[]) =>
    categories.find((category) =>
      keywords.some((keyword) => category.name.toLowerCase().includes(keyword)),
    )?.imageUrl;

  return (
    <main className="storefront-home">
      {ageGate === 'declined' && (
        <aside className="gate-notice" role="status">
          Alcohol browsing was closed. <Link href="/">Dismiss</Link>
        </aside>
      )}
      <section
        className={`home-hero${banner ? ' has-image' : ''}`}
        style={
          banner
            ? {
                backgroundImage: `linear-gradient(90deg, rgb(2 47 35 / 100%) 0%, rgb(2 47 35 / 94%) 41%, rgb(2 47 35 / 18%) 72%), url(${banner.imageUrl})`,
              }
            : undefined
        }
      >
        <div className="hero-content">
          <p className="hero-kicker">Finest South Asian provisions</p>
          <h1>{banner?.title ?? 'A little bit of Kerala in every home'}</h1>
          <p>
            {banner?.subtitle ??
              'Authentic groceries, fresh food and your favourite drinks — delivered across the UK with cold-chain care and genuine homeland taste.'}
          </p>
          <div className="hero-actions">
            <Link className="button gold" href={banner?.linkUrl ?? '/category/all'}>
              Shop now <span aria-hidden="true">→</span>
            </Link>
            <Link className="button outline-light" href="/category/all">
              Browse categories <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <span className="hero-tagline" aria-hidden="true">
          Good food
          <br />
          brings us home
        </span>
      </section>

      <section className="home-section category-section">
        <div className="section-heading home-heading">
          <div>
            <h2>Explore everyday Kerala staples</h2>
            <p>Hand-selected kitchen essentials sourced directly from the backwaters</p>
          </div>
          <Link href="/category/all">View A–Z directory →</Link>
        </div>
        <div className="category-orbits">
          {categories.slice(0, 7).map((category) => (
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
          <Link className="offers-orbit" href="/offers">
            <span>%</span>
            <strong>Offers</strong>
          </Link>
        </div>
      </section>

      <section className="home-section story-grid" aria-label="Featured departments">
        <DepartmentCard
          className="fresh"
          eyebrow="Chilled cold-chain"
          title="Fresh from the coast"
          copy="Fresh fish and vegetables available regularly with insulated delivery."
          href="/category/fresh-food"
          action="Shop fresh food"
          imageUrl={categoryImage(['fresh', 'fish', 'meat'])}
        />
        <DepartmentCard
          className="pantry"
          eyebrow="Direct Kerala brands"
          title="Authentic Kerala groceries"
          copy="Everyday essentials and traditional favourites from trusted producers."
          href="/category/groceries"
          action="Shop groceries"
          imageUrl={categoryImage(['grocery', 'rice', 'spice'])}
        />
        <DepartmentCard
          className="drinks"
          eyebrow="18+ · drink responsibly"
          title="Premium drinks & spirits"
          copy="Indian and international favourites with age-verified delivery."
          href="/alcohol"
          action="Shop alcohol"
          imageUrl={categoryImage(['alcohol', 'spirit', 'wine'])}
        />
      </section>

      <section className="home-section weekly-offer">
        <div className="offer-symbol">%</div>
        <div>
          <h2>Weekly Angadi special offers</h2>
          <p>Save on everyday South Asian essentials and multi-buy pantry staples.</p>
        </div>
        <Link className="button" href="/offers">
          View all offers →
        </Link>
      </section>

      <section className="home-section featured-section">
        <div className="section-heading home-heading">
          <div>
            <p className="eyebrow">Handpicked community favourites</p>
            <h2>Featured products</h2>
          </div>
          <Link href="/search">View all →</Link>
        </div>
        {products.length ? (
          <ProductGrid products={products.slice(0, 6)} />
        ) : (
          <div className="error-state">
            <h2>Catalogue unavailable</h2>
            <p>Please try again shortly.</p>
          </div>
        )}
      </section>

      <section className="home-section home-benefits" aria-label="Shopping benefits">
        <Benefit
          title="Next-day delivery"
          copy="Fast and tracked dispatch across London."
          icon="▣"
        />
        <Benefit
          title="Fixed delivery charge"
          copy="Clear delivery pricing at checkout."
          icon="◇"
        />
        <Benefit
          title="Chilled / frozen packing"
          copy="Thermal insulated wool liners and gel packs."
          icon="✣"
        />
        <Benefit
          title="Alcohol delivery"
          copy="Licensed courier delivery with Challenge 25."
          icon="✓"
        />
      </section>

      <section className="home-section home-editorial">
        <article className="recipe-card">
          <p className="eyebrow">Culinary heritage</p>
          <h2>Recipes &amp; inspiration</h2>
          <p>
            Traditional tastes for modern living, from Kerala-style fish curry to pantry favourites.
          </p>
          <Link className="button gold" href="/category/all">
            Explore ingredients →
          </Link>
        </article>
        <article className="community-card">
          <p className="eyebrow">Join our community</p>
          <h2>Join our Angadi family</h2>
          <p>Get access to account-only offers, saved addresses, favourites and faster checkout.</p>
          <Link className="button gold" href="/auth/register">
            Create an account →
          </Link>
        </article>
      </section>

      {content?.blocks.length ? (
        <section className="home-section cms-blocks">
          {content.blocks.slice(0, 2).map((block) => (
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

function DepartmentCard({
  className,
  eyebrow,
  title,
  copy,
  href,
  action,
  imageUrl,
}: Readonly<{
  className: string;
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
  action: string;
  imageUrl?: string | null | undefined;
}>) {
  return (
    <Link
      href={href}
      className={`story-card ${className}${imageUrl ? ' has-image' : ''}`}
      style={
        imageUrl
          ? {
              backgroundImage: `linear-gradient(90deg, rgb(2 47 35 / 94%), rgb(2 47 35 / 30%)), url(${imageUrl})`,
            }
          : undefined
      }
    >
      <small>{eyebrow}</small>
      <h2>{title}</h2>
      <p>{copy}</p>
      <b>{action} →</b>
    </Link>
  );
}

function Benefit({ title, copy, icon }: Readonly<{ title: string; copy: string; icon: string }>) {
  return (
    <div>
      <span aria-hidden="true">{icon}</span>
      <p>
        <strong>{title}</strong>
        <small>{copy}</small>
      </p>
    </div>
  );
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
