'use client';

import type { MouseEvent } from 'react';

interface ConfirmSubmitButtonProps {
  children: string;
  className?: string;
  message: string;
}

export function ConfirmSubmitButton({
  children,
  className = 'text-action danger',
  message,
}: Readonly<ConfirmSubmitButtonProps>) {
  function confirm(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(message)) event.preventDefault();
  }

  return (
    <button className={className} type="submit" onClick={confirm}>
      {children}
    </button>
  );
}
