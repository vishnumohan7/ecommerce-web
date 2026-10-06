type InvoiceLine = {
  productName: string;
  quantity: number;
  vatRateBps: number;
  vatAmountMinor: bigint;
  lineTotalMinor: bigint;
  orderCategory: 'GROCERY' | 'ALCOHOL';
};

export type InvoiceDocument = {
  invoiceNumber: string;
  orderNumber: string;
  issuedAt: Date;
  currency: string;
  lines: InvoiceLine[];
  subtotalMinor: bigint;
  discountMinor: bigint;
  deliveryFeeMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  paymentStatus: string;
  deliveryAddress: Record<string, unknown>;
  merchant: {
    legalEntityName: string;
    companyNumber: string | null;
    vatNumber: string | null;
    registeredAddress: Record<string, unknown>;
  };
};

const money = (minor: bigint, currency: string) => {
  const absolute = minor < 0n ? -minor : minor;
  const symbol = currency === 'GBP' ? '£' : `${currency} `;
  return `${minor < 0n ? '-' : ''}${symbol}${(absolute / 100n).toString()}.${(absolute % 100n).toString().padStart(2, '0')}`;
};

export function renderInvoicePdf(document: InvoiceDocument): Buffer {
  const rows = (category: 'GROCERY' | 'ALCOHOL') =>
    document.lines
      .filter((line) => line.orderCategory === category)
      .map(
        (line) =>
          `${String(line.quantity)} x ${line.productName} | VAT ${(line.vatRateBps / 100).toFixed(2)}% ${money(line.vatAmountMinor, document.currency)} | ${money(line.lineTotalMinor, document.currency)}`,
      );
  const vat = new Map<number, bigint>();
  for (const line of document.lines)
    vat.set(line.vatRateBps, (vat.get(line.vatRateBps) ?? 0n) + line.vatAmountMinor);
  return renderTextPdf([
    document.merchant.legalEntityName,
    `INVOICE ${document.invoiceNumber}`,
    `ORDER ${document.orderNumber}`,
    `ISSUED ${document.issuedAt.toISOString().slice(0, 10)}`,
    `DELIVERY ADDRESS ${JSON.stringify(document.deliveryAddress)}`,
    'GROCERY ITEMS',
    ...rows('GROCERY'),
    'ALCOHOL ITEMS (18+)',
    ...rows('ALCOHOL'),
    `SUBTOTAL ${money(document.subtotalMinor, document.currency)}`,
    `DISCOUNT ${money(document.discountMinor, document.currency)}`,
    `DELIVERY ${money(document.deliveryFeeMinor, document.currency)}`,
    ...[...vat.entries()].map(
      ([rate, amount]) => `VAT ${(rate / 100).toFixed(2)}% ${money(amount, document.currency)}`,
    ),
    `VAT INCLUDED ${money(document.taxMinor, document.currency)}`,
    `TOTAL PAID ${money(document.totalMinor, document.currency)}`,
    `PAYMENT ${document.paymentStatus}`,
    `Company ${document.merchant.companyNumber ?? 'N/A'} | VAT ${document.merchant.vatNumber ?? 'N/A'}`,
    `Registered address ${JSON.stringify(document.merchant.registeredAddress)}`,
    'Thank you for shopping with us.',
  ]);
}

export function renderTextPdf(lines: string[]): Buffer {
  const escaped = lines
    .map((line) => line.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)'))
    .map((line) => `(${line}) Tj T*`)
    .join('\n');
  const stream = `BT /F1 9 Tf 12 TL 40 800 Td\n${escaped}\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${String(Buffer.byteLength(stream))} >>\nstream\n${stream}\nendstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  body += `trailer << /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF`;
  return Buffer.from(body);
}
