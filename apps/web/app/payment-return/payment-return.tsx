'use client';
/* eslint-disable local/no-jsx-literals */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { browserApi } from '../../lib/store-api';

interface PaymentStatus {
  id: string;
  status: string;
  order?: { id: string; orderNumber: string; paymentStatus: string } | null;
}

export function PaymentReturn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment') ?? '';
  const [message, setMessage] = useState('Confirming your payment and creating your order…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!paymentId) {
      setFailed(true);
      setMessage('The payment reference is missing.');
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      try {
        const payment = await browserApi<PaymentStatus>(`/api/v1/payments/${paymentId}`);
        if (cancelled) return;
        if (payment.order) {
          router.replace(
            `/order-confirmation?order=${encodeURIComponent(payment.order.id)}&payment=${encodeURIComponent(payment.id)}&method=card`,
          );
          return;
        }
        if (payment.status === 'payment_failed' || payment.status === 'canceled') {
          setFailed(true);
          setMessage('Payment was not completed. No order has been placed.');
          return;
        }
        attempts += 1;
        if (attempts >= 30) {
          setMessage(
            'Stripe is still confirming the payment. Do not retry or pay again; refresh this page shortly.',
          );
          return;
        }
        window.setTimeout(() => void poll(), 1_000);
      } catch (reason) {
        if (cancelled) return;
        setFailed(true);
        setMessage(reason instanceof Error ? reason.message : 'Unable to confirm payment');
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [paymentId, router]);

  return (
    <section className={failed ? 'error-state' : 'form-card'}>
      <p className="eyebrow">Secure payment</p>
      <h1>{failed ? 'Payment not completed' : 'Payment processing'}</h1>
      <p role="status">{message}</p>
      {failed && (
        <Link className="button" href="/checkout">
          Return to checkout
        </Link>
      )}
    </section>
  );
}
