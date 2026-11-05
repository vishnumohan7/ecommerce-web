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
  const desktop = await uploadImage(data, 'desktopImage', value(data, 'currentImageUrl'));
  if (!desktop.ok) return destination(request, desktop, '');
  const mobile = await uploadImage(
    data,
    'mobileImage',
    value(data, 'currentMobileImageUrl'),
  );
  if (!mobile.ok) return destination(request, mobile, '');
  const imageUrl = desktop.imageUrl;

  if (!imageUrl) {
    return destination(request, { ok: false, error: 'Choose a desktop banner image.' }, '');
  }

  const payload = {
    title: value(data, 'title'),
    subtitle: value(data, 'subtitle') || null,
    imageUrl,
    mobileImageUrl: mobile.imageUrl || null,
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

async function uploadImage(data: FormData, field: string, currentImageUrl: string) {
  const image = data.get(field);
  if (!(image instanceof File) || image.size === 0) {
    return { ok: true as const, imageUrl: currentImageUrl };
  }

  const upload = new FormData();
  upload.set('file', image);
  const uploaded = await adminFormMutation<{ imageUrl: string }>(
    '/api/v1/admin/content/banner-assets',
    upload,
  );
  return uploaded.ok
    ? { ok: true as const, imageUrl: uploaded.data.imageUrl }
    : { ok: false as const, error: uploaded.error };
}
