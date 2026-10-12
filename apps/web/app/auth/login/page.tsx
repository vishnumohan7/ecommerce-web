import { AuthForm } from '../../../components/auth-form';

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ error?: string }> }>) {
  const { error } = await searchParams;
  return <AuthForm mode="login" initialMessage={error ?? ''} />;
}
