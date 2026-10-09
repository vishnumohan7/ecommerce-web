/* eslint-disable local/no-jsx-literals */
import { moderateReview } from '../actions';
import { ActionMessage } from '../components/action-message';
import { ApiNotice } from '../components/api-notice';
import { TablePagination } from '../components/table-pagination';
import { fetchReviews } from '../lib/api';
export const dynamic = 'force-dynamic';
export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; success?: string; error?: string }>;
}) {
  const p = await searchParams;
  const result = await fetchReviews({ ...(p.status ? { status: p.status } : {}), page: Math.max(1, Number(p.page) || 1) });
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Trust & content</p>
          <h1>Review moderation</h1>
          <p>Approve or reject verified-purchase reviews.</p>
        </div>
      </section>
      <ActionMessage success={p.success} error={p.error} />
      {!result.ok ? (
        <ApiNotice message={result.error} />
      ) : result.data.items.length === 0 ? (
        <article className="panel">
          <p className="panel-empty">There are no reviews waiting for moderation.</p>
        </article>
      ) : (
        <section className="moderation-list">
          {result.data.items.map((review) => (
            <article className="panel" key={review.id}>
              <header className="panel-header">
                <div>
                  <strong className="review-rating">{'★'.repeat(review.rating)}</strong>
                  <h2>{review.title ?? 'Customer review'}</h2>
                  <small>
                    {review.status} · {new Date(review.createdAt).toLocaleString('en-GB')}
                  </small>
                </div>
              </header>
              <p>{review.body}</p>
              <form action={moderateReview} className="row-form">
                <input type="hidden" name="id" value={review.id} />
                <input name="reason" placeholder="Add moderation note" />
                <button name="status" value="APPROVED" className="button button-primary">
                  Approve
                </button>
                <button name="status" value="REJECTED" className="button button-danger">
                  Reject
                </button>
              </form>
            </article>
          ))}
          <TablePagination basePath="/reviews" page={result.data.page} pageCount={result.data.pageCount} total={result.data.total} params={p.status ? { status: p.status } : {}} />
        </section>
      )}
    </>
  );
}
