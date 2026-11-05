'use client';

import { useState, type FormEvent, type ReactNode } from 'react';

const MAX_UPLOAD_BYTES = 1024 * 1024;
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 960;

export function BannerUploadForm({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const data = new FormData(event.currentTarget);
      const image = data.get('desktopImage');
      if (image instanceof File && image.size > 0) {
        data.set('desktopImage', await optimiseBanner(image));
      }

      const response = await fetch('/api/banner-slides', { method: 'POST', body: data });
      if (!response.ok) throw new Error(`Upload failed with status ${response.status}.`);
      window.location.assign(response.url || '/content');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The banner could not be uploaded.');
      setSubmitting(false);
    }
  }

  return (
    <form className={className} onSubmit={submit} encType="multipart/form-data">
      {children}
      {submitting && (
        <p className="form-progress" role="status">
          Optimising and uploading image…
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

async function optimiseBanner(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
  let width = Math.max(1, Math.round(bitmap.width * scale));
  let height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  let quality = 0.82;
  let blob: Blob;

  do {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not process the selected image.');
    context.drawImage(bitmap, 0, 0, width, height);
    blob = await canvasBlob(canvas, quality);

    if (blob.size > MAX_UPLOAD_BYTES) {
      if (quality > 0.5) quality -= 0.08;
      else {
        width = Math.max(960, Math.round(width * 0.82));
        height = Math.max(1, Math.round((width * bitmap.height) / bitmap.width));
        quality = 0.74;
      }
    }
  } while (blob.size > MAX_UPLOAD_BYTES && width > 960);

  if (blob.size > MAX_UPLOAD_BYTES) {
    canvas.width = 960;
    canvas.height = Math.max(1, Math.round((960 * bitmap.height) / bitmap.width));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not process the selected image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await canvasBlob(canvas, 0.5);
  }
  bitmap.close();
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error('The image remains too large after optimisation. Please choose a smaller image.');
  }
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed.'))),
      'image/webp',
      quality,
    );
  });
}
