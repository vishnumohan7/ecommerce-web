import { NextResponse } from 'next/server';
import { adminFormMutation, adminMutation } from '../../lib/api';

export const runtime = 'nodejs';

function value(data: FormData, key: string) {
  const entry = data.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
}

function destination(request: Request, result: { ok: boolean; error?: string }, success: string) {
  const url = new URL('/content', request.url);
  url.searchParams.set(
    result.ok ? 'success' : 'error',
    result.ok ? success : (result.error ?? 'The operation failed.'),
  );
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const data = await request.formData();
  const intent = value(data, 'intent');
  const image = data.get('desktopImage');
  let imageUrl = value(data, 'currentImageUrl');

  if (image instanceof File && image.size > 0) {
    const upload = new FormData();
    upload.set('file', image);
    const uploaded = await adminFormMutation<{ imageUrl: string }>(
      '/api/v1/admin/content/banner-assets',
      upload,
    );
    if (!uploaded.ok) return destination(request, uploaded, '');
    imageUrl = uploaded.data.imageUrl;
  }

  if (!imageUrl) {
    return destination(request, { ok: false, error: 'Choose a desktop banner image.' }, '');
  }

  const payload = {
    title: value(data, 'title'),
    subtitle: value(data, 'subtitle') || null,
    imageUrl,
    mobileImageUrl: null,
    linkUrl: value(data, 'linkUrl') || null,
    position: Number(value(data, 'position') || '0'),
    startsAt: value(data, 'startsAt') || null,
    endsAt: value(data, 'endsAt') || null,
  };

  if (intent === 'update') {
    const id = value(data, 'id');
    const result = await adminMutation(
      `/api/v1/admin/content/banners/${encodeURIComponent(id)}`,
      'PATCH',
      payload,
    );
    return destination(request, result, 'Slide updated.');
  }

  const result = await adminMutation('/api/v1/admin/content/banners', 'POST', {
    ...payload,
    active: true,
  });
  return destination(request, result, 'Slide created.');
}
