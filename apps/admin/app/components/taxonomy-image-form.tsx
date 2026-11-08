'use client';

/* eslint-disable local/no-jsx-literals */
import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';

const MAX_IMAGE_BYTES = 900 * 1024;
const MAX_IMAGE_EDGE = 1400;

interface TaxonomyImageFormProps {
  action: (data: FormData) => Promise<{ ok: boolean; error?: string }>;
  children: ReactNode;
  className?: string;
  successMessage: string;
}

export function TaxonomyImageForm({
  action,
  children,
  className,
  successMessage,
}: Readonly<TaxonomyImageFormProps>) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (processing) return;

    const form = event.currentTarget;
    setProcessing(true);
    setError('');
    try {
      const data = new FormData(form);
      const image = data.get('image');
      if (image instanceof File && image.size > 0) {
        data.set('image', await optimiseTaxonomyImage(image));
      }
      const result = await action(data);
      if (!result.ok) throw new Error(result.error ?? 'The item could not be saved.');
      form.reset();
      router.replace(`?success=${encodeURIComponent(successMessage)}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The category could not be saved.');
      setProcessing(false);
    }
  }

  return (
    <form className={className} onSubmit={(event) => void submit(event)}>
      {children}
      {processing && (
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

async function optimiseTaxonomyImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / bitmap.width, MAX_IMAGE_EDGE / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not process the selected image.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.82, 0.7, 0.58, 0.46]) {
    const blob = await canvasBlob(canvas, quality);
    if (blob.size <= MAX_IMAGE_BYTES) {
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
        type: 'image/webp',
      });
    }
  }
  throw new Error('The image is too large to upload. Please choose a smaller image.');
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Image optimisation failed.'));
      },
      'image/webp',
      quality,
    );
  });
}
