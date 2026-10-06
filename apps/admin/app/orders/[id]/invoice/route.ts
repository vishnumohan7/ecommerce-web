import { API_BASE_URL } from '../../../lib/api';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return new Response('ADMIN_API_TOKEN is not configured.', { status: 503 });
  const { id } = await params;
  const response = await fetch(
    `${API_BASE_URL}/api/v1/admin/orders/${encodeURIComponent(id)}/invoice`,
    {
      cache: 'no-store',
      headers: { accept: 'application/pdf', authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok)
    return new Response('Invoice could not be downloaded.', { status: response.status });
  return new Response(await response.arrayBuffer(), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition':
        response.headers.get('content-disposition') ?? 'attachment; filename="invoice.pdf"',
    },
  });
}
