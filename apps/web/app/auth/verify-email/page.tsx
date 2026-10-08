import { VerifyEmail } from '../../../components/verify-email';

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ token?: string }> }>) {
  const { token = '' } = await searchParams;
  return <VerifyEmail token={token} />;
}
