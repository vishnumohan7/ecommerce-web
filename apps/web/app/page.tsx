const messages = {
  heading: 'Storefront',
  description: 'Your local grocery and drinks shop.',
  declined: 'Alcohol browsing was closed. ',
  dismiss: 'Dismiss',
  alcohol: 'Browse alcohol',
};

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ ageGate?: string | string[] }> }>) {
  const params = await searchParams;
  return (
    <main className="store-page">
      {params.ageGate === 'declined' && (
        <aside className="gate-notice" role="status">
          {messages.declined}
          <a href="/">{messages.dismiss}</a>
        </aside>
      )}
      <h1>{messages.heading}</h1>
      <p>{messages.description}</p>
      <a className="store-link" href="/alcohol">
        {messages.alcohol}
      </a>
    </main>
  );
}
