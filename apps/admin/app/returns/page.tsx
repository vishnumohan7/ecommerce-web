/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { reviewReturn } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { fetchReturns } from '../lib/api';

export const metadata: Metadata = { title: 'Returns & refunds' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ status?: string; orderId?: string; success?: string; error?: string }>;
}

function badgeClass(status: string) {
  if (['APPROVED', 'COMPLETED'].includes(status)) return 'status-active';
  if (status === 'REJECTED') return 'status-down';
  return 'status-warn';
}

export default async function ReturnsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const result = await fetchReturns({
    ...(query.status ? { status: query.status } : {}),
    ...(query.orderId ? { orderId: query.orderId } : {}),
  });
  const requests = result.ok ? result.data : [];

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">After-sales operations</p>
          <h1>Returns & refunds</h1>
          <p>Review customer return requests and follow their refund progress.</p>
        </div>
        <span className="count-pill">{requests.length} requests</span>
      </section>
      <ActionMessage success={query.success} error={query.error} />
      {!result.ok && <ApiNotice message={result.error} />}
      <article className="panel">
        <form className="order-filters" action="/returns">
          <input
            name="orderId"
            defaultValue={query.orderId}
            placeholder="Order UUID"
            aria-label="Filter by order ID"
          />
          <select name="status" defaultValue={query.status ?? ''} aria-label="Return status">
            <option value="">All statuses</option>
            <option value="REQUESTED">Requested</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="REFUND_PENDING">Refund pending</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <button className="button button-primary" type="submit">
            Apply filters
          </button>
          <Link className="clear-link" href="/returns">
            Clear
          </Link>
        </form>
        {result.ok && requests.length > 0 ? (
          <div className="return-list">
            {requests.map((request) => (
              <section className="return-card" key={request.id}>
                <header>
                  <div>
                    <span className={`status-badge ${badgeClass(request.status)}`}>
                      <span />
                      {request.status.replaceAll('_', ' ')}
                    </span>
                    <h2>{request.reason.replaceAll('_', ' ')}</h2>
                    <p>
                      Requested {new Date(request.createdAt).toLocaleString('en-GB')} · Reference{' '}
                      <code>{request.id}</code>
                    </p>
                  </div>
                  <Link className="button button-muted" href={`/orders/${request.orderId}`}>
                    Open order
                  </Link>
                </header>
                {request.customerNote && (
                  <blockquote>
                    <strong>Customer note</strong>
                    <span>{request.customerNote}</span>
                  </blockquote>
                )}
                {request.status === 'REQUESTED' ? (
                  <form action={reviewReturn} className="return-review-form">
                    <input type="hidden" name="id" value={request.id} />
                    <label>
                      Decision
                      <select name="status" defaultValue="APPROVED">
                        <option value="APPROVED">Approve</option>
                        <option value="REJECTED">Reject</option>
                      </select>
                    </label>
                    <label>
                      Disposition for approval
                      <select name="disposition" defaultValue="RESTOCK">
                        <option value="RESTOCK">Restock</option>
                        <option value="WRITE_OFF">Write off</option>
                      </select>
                    </label>
                    <label className="return-note-field">
                      Review note
                      <input
                        name="adminNote"
                        maxLength={1000}
                        placeholder="Optional internal note"
                      />
                    </label>
                    <button className="button button-primary" type="submit">
                      Submit review
                    </button>
                  </form>
                ) : (
                  <div className="review-outcome">
                    <span>
                      Disposition: {request.disposition?.replaceAll('_', ' ') ?? 'Not set'}
                    </span>
                    <span>{request.adminNote ?? 'No review note.'}</span>
                  </div>
                )}
              </section>
            ))}
          </div>
        ) : result.ok ? (
          <div className="empty-state">
            <span>↩</span>
            <h3>No matching return requests</h3>
            <p>New customer requests will appear in this review queue.</p>
          </div>
        ) : null}
      </article>
    </>
  );
}
