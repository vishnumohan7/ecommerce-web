import { Suspense } from 'react';
import { PaymentReturn } from './payment-return';
/* eslint-disable local/no-jsx-literals */

export default function PaymentReturnPage() {
  return (
    <main className="section narrow">
      <Suspense fallback={<section className="form-card">Confirming your payment…</section>}>
        <PaymentReturn />
      </Suspense>
    </main>
  );
}
