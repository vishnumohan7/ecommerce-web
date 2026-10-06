import { describe, expect, it } from 'vitest';
import { renderInvoicePdf } from '../src/modules/orders/invoice.renderer';
import {
  renderAlcoholComplianceCsv,
  renderAlcoholCompliancePdf,
} from '../src/modules/orders/compliance.renderer';
import {
  isFulfilmentTransitionAllowed,
  validateSubstitution,
} from '../src/modules/orders/order.service';

describe('orders and invoices', () => {
  it('enforces the fulfilment transition table', () => {
    expect(isFulfilmentTransitionAllowed('CONFIRMED', 'PICKING')).toBe(true);
    expect(isFulfilmentTransitionAllowed('PICKING', 'DELIVERED')).toBe(false);
    expect(isFulfilmentTransitionAllowed('DELIVERED', 'PENDING')).toBe(false);
  });

  it('prevents cross-category and weaker age-restricted substitutions', () => {
    expect(() =>
      validateSubstitution(
        { isAlcohol: true, ageRestriction: 18 },
        { isAlcohol: false, ageRestriction: 18 },
      ),
    ).toThrow(/cannot substitute/);
    expect(() =>
      validateSubstitution(
        { isAlcohol: true, ageRestriction: 21 },
        { isAlcohol: true, ageRestriction: 18 },
      ),
    ).toThrow(/equal or stricter/);
  });

  it('renders one deterministic PDF containing grocery, alcohol, VAT and merchant sections', () => {
    const input = {
      invoiceNumber: 'INV-2026-000001',
      orderNumber: 'ORD-2026-000001',
      issuedAt: new Date('2026-10-06T00:00:00.000Z'),
      currency: 'GBP',
      lines: [
        {
          productName: 'Milk',
          quantity: 1,
          vatRateBps: 0,
          vatAmountMinor: 0n,
          lineTotalMinor: 150n,
          orderCategory: 'GROCERY' as const,
        },
        {
          productName: 'Wine',
          quantity: 1,
          vatRateBps: 2000,
          vatAmountMinor: 200n,
          lineTotalMinor: 1200n,
          orderCategory: 'ALCOHOL' as const,
        },
      ],
      subtotalMinor: 1350n,
      discountMinor: 0n,
      deliveryFeeMinor: 299n,
      taxMinor: 200n,
      totalMinor: 1649n,
      paymentStatus: 'CAPTURED',
      deliveryAddress: { postcode: 'SE1 1AA' },
      merchant: {
        legalEntityName: 'Demo Merchant Ltd',
        companyNumber: '12345678',
        vatNumber: 'GB123456789',
        registeredAddress: { city: 'London' },
      },
    };
    const first = renderInvoicePdf(input);
    const second = renderInvoicePdf(input);
    expect(first.equals(second)).toBe(true);
    const text = first.toString('utf8');
    expect(text).toContain('GROCERY ITEMS');
    expect(text).toContain('ALCOHOL ITEMS \\(18+\\)');
    expect(text).toContain('TOTAL PAID £16.49');
    expect(text).toContain('GB123456789');
  });

  it('renders the same alcohol-only compliance rows to PDF and CSV', () => {
    const lines = [
      {
        dispatchDate: new Date('2026-10-06T00:00:00.000Z'),
        orderId: 'order-alcohol',
        productName: 'Red Wine',
        quantity: 2,
        lineTotalMinor: 2198n,
        currency: 'GBP',
        recipientName: 'Test Recipient',
        recipientAddress: { postcode: 'SE1 1AA' },
      },
    ];
    expect(renderAlcoholComplianceCsv(lines)).toContain('Red Wine');
    const pdf = renderAlcoholCompliancePdf('ALCOHOL DESPATCH DAY BOOK', lines).toString('utf8');
    expect(pdf).toContain('Red Wine');
    expect(pdf).toContain('Test Recipient');
    expect(pdf).toContain('TOTAL ALCOHOL LINES 1');
  });
});
