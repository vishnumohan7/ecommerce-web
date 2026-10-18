'use client';

/* eslint-disable local/no-jsx-literals -- Admin form labels are English-only. */

import { useState } from 'react';
import { productSlug } from '../lib/product-slug';

interface Props {
  initialName?: string;
  initialSlug?: string;
  autoGenerateSlug: boolean;
}

export function ProductIdentityFields({
  initialName = '',
  initialSlug = '',
  autoGenerateSlug,
}: Readonly<Props>) {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug || productSlug(initialName));
  const [slugEdited, setSlugEdited] = useState(!autoGenerateSlug);

  return (
    <>
      <label>
        Name
        <input
          name="name"
          value={name}
          onChange={(event) => {
            const nextName = event.target.value;
            setName(nextName);
            if (!slugEdited) setSlug(productSlug(nextName));
          }}
          required
        />
      </label>
      <label>
        URL slug
        <input
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(productSlug(event.target.value));
          }}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="Generated from the product name"
          required
        />
        <small>Lowercase letters, numbers and hyphens only.</small>
      </label>
    </>
  );
}
