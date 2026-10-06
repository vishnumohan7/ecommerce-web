export const metadata = { title: 'Alcohol — Denes' };
const messages = {
  eyebrow: 'Age-gated catalogue',
  heading: 'Beer, wine and spirits',
  description:
    'Your browsing confirmation is valid. Product merchandising arrives with Milestone 16.',
};

export default function AlcoholPage() {
  return (
    <main className="store-page">
      <p className="eyebrow">{messages.eyebrow}</p>
      <h1>{messages.heading}</h1>
      <p>{messages.description}</p>
    </main>
  );
}
