import { notFound } from 'next/navigation';

const api = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://127.0.0.1:3000'
).replace(/\/$/, '');

export default async function ProductPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const response = await fetch(`${api}/api/v1/products/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (!response.ok) notFound();
  const product = (await response.json()) as {
    name: string;
    description: string;
    ageRestriction: number;
    unitPriceDisplay: string;
  };
  return (
    <main className="store-page">
      {product.ageRestriction > 0 && (
        <p className="age-badge">{product.ageRestriction.toString().concat('+')}</p>
      )}
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <small>{product.unitPriceDisplay}</small>
    </main>
  );
}
