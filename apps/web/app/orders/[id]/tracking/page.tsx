import { redirect } from 'next/navigation';

interface TrackingPageProps {
  params: Promise<{ id: string }>;
}

export default async function TrackingPage({ params }: Readonly<TrackingPageProps>) {
  const { id } = await params;
  redirect(`/orders/${id}#tracking`);
}
