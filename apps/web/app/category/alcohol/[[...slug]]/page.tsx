export const metadata = { title: 'Alcohol category — Denes' };
const messages = {
  eyebrow: 'Age-gated category',
  heading: 'Alcohol catalogue',
  description:
    'Your browsing confirmation is valid. Category merchandising arrives with Milestone 16.',
};

export default function AlcoholCategoryPage() {
  return (
    <main className="store-page">
      <p className="eyebrow">{messages.eyebrow}</p>
      <h1>{messages.heading}</h1>
      <p>{messages.description}</p>
    </main>
  );
}
