# Integrations

## Stripe

Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the storefront's publishable key. The API creates PaymentIntents with automatic payment methods so Stripe Payment Element clients can complete SCA/3DS with `stripe.confirmPayment` and a return URL. Variable-weight baskets use manual capture with the configured variance buffer.

The merchant must disclose grocery and alcohol sales during Stripe onboarding. Alcohol is a regulated/restricted category. BNPL methods must not be offered for baskets containing alcohol.

Register `/api/v1/webhooks/stripe` for `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.amount_capturable_updated`, `charge.refunded`, and `charge.dispute.created`. The endpoint requires Stripe's exact raw request body.
