import { redirect } from 'next/navigation';

export default async function LegacyOrderConfirmation({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ payment?: string; order?: string; method?: string }>;
}>) {
  const data = await searchParams;
  const query = new URLSearchParams();

  if (data.order) query.set('confirmed', data.order);
  if (data.payment) query.set('payment', data.payment);
  query.set('method', data.method === 'card' ? 'card' : 'cod');

  redirect(`/orders?${query.toString()}`);
}
