import Link from 'next/link';

interface Props {
  basePath: string;
  page: number;
  pageCount: number;
  params?: Record<string, string>;
  total: number;
}

export function TablePagination({ basePath, page, pageCount, params = {}, total }: Readonly<Props>) {
  if (pageCount <= 1) return <p className="pagination-summary">{total.toLocaleString('en-GB')} records</p>;
  const pages = Array.from(
    new Set([1, page - 2, page - 1, page, page + 1, page + 2, pageCount]),
  ).filter((value) => value >= 1 && value <= pageCount);
  const href = (target: number) => {
    const query = new URLSearchParams(params);
    query.set('page', String(target));
    return `${basePath}?${query.toString()}`;
  };
  return (
    <nav className="table-pagination" aria-label="Table pages">
      <span>{total.toLocaleString('en-GB')} records · Page {page} of {pageCount}</span>
      <div>
        <Link aria-disabled={page <= 1} className={page <= 1 ? 'disabled' : ''} href={href(Math.max(1, page - 1))}>Previous</Link>
        {pages.map((value, index) => (
          <span key={value} className="pagination-page-slot">
            {index > 0 && pages[index - 1] !== value - 1 && <i>…</i>}
            <Link aria-current={value === page ? 'page' : undefined} href={href(value)}>{value}</Link>
          </span>
        ))}
        <Link aria-disabled={page >= pageCount} className={page >= pageCount ? 'disabled' : ''} href={href(Math.min(pageCount, page + 1))}>Next</Link>
      </div>
    </nav>
  );
}
