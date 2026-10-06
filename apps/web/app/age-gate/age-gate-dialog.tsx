'use client';

import { useEffect, useRef } from 'react';

const messages = {
  mark: '18+',
  eyebrow: 'Age-restricted area',
  title: 'Are you 18 or over?',
  description:
    'You must be aged 18 or over to browse alcohol products. This browsing check does not verify your eligibility to purchase; checkout performs a separate age verification.',
  confirm: 'Yes, I am 18 or over',
  decline: 'No, take me home',
  expiry: 'The browsing confirmation expires after 30 days.',
};

export function AgeGateDialog({ returnTo }: Readonly<{ returnTo: string }>) {
  const dialog = useRef<HTMLDivElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirm.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        document.querySelector<HTMLFormElement>('#age-gate-decline')?.requestSubmit();
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button, a[href]')].filter(
        (element) => !element.hasAttribute('disabled'),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="age-gate-backdrop">
      <div
        ref={dialog}
        className="age-gate-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        aria-describedby="age-gate-description"
      >
        <span className="age-gate-mark" aria-hidden="true">
          {messages.mark}
        </span>
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1 id="age-gate-title">{messages.title}</h1>
        <p id="age-gate-description">{messages.description}</p>
        <div className="age-gate-actions">
          <form method="post" action={`/age-gate/confirm?returnTo=${encodeURIComponent(returnTo)}`}>
            <button ref={confirm} className="gate-button gate-button-primary" type="submit">
              {messages.confirm}
            </button>
          </form>
          <form id="age-gate-decline" method="post" action="/age-gate/decline">
            <button className="gate-button gate-button-secondary" type="submit">
              {messages.decline}
            </button>
          </form>
        </div>
        <small>{messages.expiry}</small>
      </div>
    </div>
  );
}
