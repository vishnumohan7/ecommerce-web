import Link from 'next/link';
/* eslint-disable local/no-jsx-literals */

export default async function Confirmation({
  searchParams,
}: Readonly<{ searchParams: Promise<{ payment?: string; status?: string; order?: string }> }>) {
  const data = await searchParams;
  return (
    <main className="confirmation-page">
      <section className="confirmation-hero">
        <span>✓</span>
        <div>
          <p className="eyebrow">Order confirmed</p>
          <h1>Thank you. Your order has been placed.</h1>
          <p>
            Your order, invoice and fulfilment record are ready. Payment will be collected on
            delivery.
          </p>
        </div>
        <div className="confirmation-actions">
          <Link
            className="button secondary"
            href={data.order ? `/orders/${data.order}` : '/orders'}
          >
            View order
          </Link>
          {data.order && (
            <a className="button secondary" href={`/api/store/api/v1/orders/${data.order}/invoice`}>
              Download invoice
            </a>
          )}
          <Link className="button gold" href="/">
            Continue shopping
          </Link>
        </div>
      </section>
      <section className="confirmation-grid">
        <article>
          <p className="eyebrow">Payment</p>
          <h2>Cash on delivery</h2>
          {data.payment && (
            <p>
              Reference <code>{data.payment}</code>
            </p>
          )}
          <p>Payment remains pending until collection at delivery.</p>
        </article>
        <article>
          <p className="eyebrow">Fulfilment</p>
          <h2>Order received</h2>
          <ol className="confirmation-timeline">
            <li className="complete">Order placed</li>
            <li>Picking and packing</li>
            <li>Dispatched</li>
            <li>Delivered</li>
          </ol>
        </article>
        <article>
          <p className="eyebrow">Important</p>
          <h2>Delivery checks</h2>
          <p>
            If alcohol is included, Challenge 25 applies and valid photo ID may be requested at
            delivery.
          </p>
        </article>
      </section>
    </main>
  );
}
