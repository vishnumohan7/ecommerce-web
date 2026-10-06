import type { Metadata } from 'next';
import { safeReturnTo } from '../../lib/age-gate';
import { AgeGateDialog } from './age-gate-dialog';

export const metadata: Metadata = { title: 'Age confirmation — Denes' };

export default async function AgeGatePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ returnTo?: string | string[] }> }>) {
  const params = await searchParams;
  const returnTo = safeReturnTo(typeof params.returnTo === 'string' ? params.returnTo : null);
  return <AgeGateDialog returnTo={returnTo} />;
}
