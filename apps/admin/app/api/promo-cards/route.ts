import { NextResponse } from 'next/server';
import { adminFormMutation, adminMutation } from '../../lib/api';

export const runtime = 'nodejs';

function value(data: FormData, key: string) {
  const entry = data.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
}

function redirect(request: Request, result: { ok: boolean; error?: string }, success: string) {
  const url = new URL('/content', request.url);
  url.searchParams.set(
    result.ok ? 'success' : 'error',
    result.ok ? success : (result.error ?? 'The operation failed.'),
  );
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const data = await request.formData();
  const currentImageUrl = value(data, 'currentImageUrl');
  const image = data.get('promoImage');
  let imageUrl = currentImageUrl;

  if (image instanceof File && image.size > 0) {
    const upload = new FormData();
    upload.set('file', image);
    const uploaded = await adminFormMutation<{ imageUrl: string }>(
      '/api/v1/admin/content/banner-assets',
      upload,
    );
    if (!uploaded.ok) return redirect(request, uploaded, '');
    imageUrl = uploaded.data.imageUrl;
  }

  const payload = {
    type: 'PROMO_BLOCK',
    title: value(data, 'title'),
    position: Number(value(data, 'position') || '0'),
    startsAt: value(data, 'startsAt') || null,
    endsAt: value(data, 'endsAt') || null,
    content: {
      eyebrow: value(data, 'eyebrow'),
      description: value(data, 'description'),
      buttonLabel: value(data, 'buttonLabel'),
      linkUrl: value(data, 'linkUrl'),
      imageUrl: imageUrl || null,
      tone: value(data, 'tone') || 'fresh',
    },
  };

  const id = value(data, 'id');
  const result = id
    ? await adminMutation(
        `/api/v1/admin/content/blocks/${encodeURIComponent(id)}`,
        'PATCH',
        payload,
      )
    : await adminMutation('/api/v1/admin/content/blocks', 'POST', { ...payload, active: true });
  return redirect(request, result, id ? 'Promotional card updated.' : 'Promotional card created.');
}
