type InvoiceLine = {
  productName: string;
  sku?: string;
  quantity: number;
  unitPriceMinor?: bigint;
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
  customer?: Record<string, unknown>;
  deliverySlot?: { startsAt: Date; endsAt: Date } | null;
  merchant: {
    brandName?: string;
    legalEntityName: string;
    companyNumber: string | null;
    vatNumber: string | null;
    registeredAddress: Record<string, unknown>;
  };
};

const W = 595;
const H = 842;
const NAVY = '#101b3a';
const INK = '#182033';
const MUTED = '#667085';
const LINE = '#d8dee8';
const GREEN = '#168353';
const GREEN_PALE = '#f1faf5';
const RED = '#b4233d';
const RED_PALE = '#fff5f6';

const money = (minor: bigint, currency: string) => {
  const absolute = minor < 0n ? -minor : minor;
  const symbol = currency === 'GBP' ? '£' : `${currency} `;
  return `${minor < 0n ? '-' : ''}${symbol}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
};

const value = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
};

const nameOf = (source: Record<string, unknown>) =>
  value(source, ['name', 'fullName', 'recipientName']) ||
  [value(source, ['firstName', 'givenName']), value(source, ['lastName', 'familyName'])]
    .filter(Boolean)
    .join(' ');

const addressOf = (source: Record<string, unknown>) => {
  const result = [
    nameOf(source),
    value(source, ['line1', 'addressLine1', 'street', 'streetAddress']),
    value(source, ['line2', 'addressLine2', 'locality']),
    [
      value(source, ['city', 'town']),
      value(source, ['county', 'region']),
      value(source, ['postcode', 'postalCode', 'zip']),
    ]
      .filter(Boolean)
      .join(', '),
    value(source, ['country', 'countryName']) || 'United Kingdom',
  ].filter(Boolean);
  const phone = value(source, ['phone', 'phoneNumber', 'mobile']);
  if (phone) result.push(`Phone: ${phone}`);
  return result.length ? result : ['Address supplied with order'];
};

const rgb = (colour: string) =>
  [0, 2, 4]
    .map((index) => Number.parseInt(colour.slice(1).slice(index, index + 2), 16) / 255)
    .map((part) => part.toFixed(3))
    .join(' ');

const escape = (text: string) =>
  text
    .replaceAll('–', '-')
    .replaceAll('—', '-')
    .replaceAll('’', "'")
    .replaceAll('✓', 'OK')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll('£', '\\243')
    .replace(/[^\x20-\x7e\\]/g, '');

const wrap = (text: string, limit: number) => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= limit || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
};

class Page {
  commands: string[] = [];

  rect(x: number, top: number, width: number, height: number, fill: string, stroke?: string) {
    const y = H - top - height;
    this.commands.push('q', `${rgb(fill)} rg`, `${x} ${y} ${width} ${height} re f`);
    if (stroke) this.commands.push(`${rgb(stroke)} RG`, '0.7 w', `${x} ${y} ${width} ${height} re S`);
    this.commands.push('Q');
  }

  rule(x1: number, top1: number, x2: number, top2: number, colour = LINE) {
    this.commands.push(
      'q',
      `${rgb(colour)} RG`,
      '0.7 w',
      `${x1} ${H - top1} m ${x2} ${H - top2} l S`,
      'Q',
    );
  }

  text(
    text: string,
    x: number,
    top: number,
    options: {
      size?: number;
      bold?: boolean;
      colour?: string;
      align?: 'left' | 'right' | 'center';
      width?: number;
    } = {},
  ) {
    const size = options.size ?? 9;
    const width = options.width ?? 0;
    const estimate = text.length * size * 0.49;
    const left =
      options.align === 'right' && width
        ? x + width - estimate
        : options.align === 'center' && width
          ? x + (width - estimate) / 2
          : x;
    this.commands.push(
      'BT',
      `${rgb(options.colour ?? INK)} rg`,
      `/${options.bold ? 'F2' : 'F1'} ${size} Tf`,
      `${left.toFixed(1)} ${(H - top - size).toFixed(1)} Td`,
      `(${escape(text)}) Tj`,
      'ET',
    );
  }
}

const header = (page: Page, document: InvoiceDocument, continued = false) => {
  page.rect(0, 0, W, 40, NAVY);
  page.text(`INVOICE / ORDER CONFIRMATION${continued ? ' - CONTINUED' : ''}`, 0, 13, {
    size: 14,
    bold: true,
    colour: '#ffffff',
    align: 'center',
    width: W,
  });
  if (continued) {
    page.text(document.invoiceNumber, 36, 55, { size: 8, colour: MUTED });
    page.text(`Order ${document.orderNumber}`, 419, 55, {
      size: 8,
      colour: MUTED,
      align: 'right',
      width: 140,
    });
  }
};

const compile = (pages: Page[]) => {
  const regular = 3 + pages.length * 2;
  const bold = regular + 1;
  const pageRefs = pages.map((_, index) => 3 + index * 2);
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];
  pages.forEach((page, index) => {
    const stream = page.commands.join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${4 + index * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    );
  });
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );
  let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'latin1');
};

export function renderInvoicePdf(document: InvoiceDocument): Buffer {
  const firstPage = new Page();
  const pages: Page[] = [firstPage];
  let page: Page = firstPage;
  header(page, document);

  const brand = document.merchant.brandName || document.merchant.legalEntityName;
  page.rect(36, 62, 48, 48, GREEN);
  page.text(brand.slice(0, 1).toUpperCase(), 36, 73, {
    size: 25,
    bold: true,
    colour: '#ffffff',
    align: 'center',
    width: 48,
  });
  page.text(brand, 98, 65, { size: 20, bold: true, colour: NAVY });
  page.text('Online grocery & drinks', 98, 91, { size: 9, colour: MUTED });
  page.text('VAT INVOICE', 389, 64, { size: 18, bold: true, colour: NAVY, align: 'right', width: 170 });
  page.text(`Invoice ${document.invoiceNumber}`, 389, 89, { size: 9, colour: MUTED, align: 'right', width: 170 });
  page.text(`Order ${document.orderNumber}`, 389, 104, { size: 9, colour: MUTED, align: 'right', width: 170 });
  page.rule(36, 127, 559, 127);

  const address = addressOf(document.deliveryAddress);
  const customer = document.customer ?? {};
  const customerName = nameOf(customer);
  if (customerName && !address.includes(customerName)) address.unshift(customerName);
  const email = value(customer, ['email', 'emailAddress']);
  if (email) address.push(email);
  page.rect(36, 139, 523, 116, '#ffffff', LINE);
  page.text('DELIVERY ADDRESS', 48, 151, { size: 8, bold: true, colour: GREEN });
  address.slice(0, 7).forEach((line, index) =>
    page.text(line, 48, 170 + index * 13, { size: 8.5, bold: index === 0 }),
  );
  page.text('ORDER DETAILS', 318, 151, { size: 8, bold: true, colour: NAVY });
  const date = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(document.issuedAt);
  page.text('Issued', 318, 171, { size: 8.5, colour: MUTED });
  page.text(date, 408, 171, { size: 8.5, bold: true });
  page.text('Payment', 318, 190, { size: 8.5, colour: MUTED });
  page.text(document.paymentStatus.replaceAll('_', ' '), 408, 190, {
    size: 8.5,
    bold: true,
    colour: document.paymentStatus === 'CAPTURED' ? GREEN : INK,
  });
  if (document.deliverySlot) {
    const day = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeZone: 'Europe/London',
    }).format(document.deliverySlot.startsAt);
    const time = (input: Date) =>
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/London',
      }).format(input);
    page.text('Delivery date', 318, 209, { size: 8.5, colour: MUTED });
    page.text(day, 408, 209, { size: 8.5, bold: true });
    page.text('Delivery slot', 318, 228, { size: 8.5, colour: MUTED });
    page.text(`${time(document.deliverySlot.startsAt)}-${time(document.deliverySlot.endsAt)}`, 408, 228, {
      size: 8.5,
      bold: true,
    });
  }

  let cursor = 276;
  const ensure = (space: number) => {
    if (cursor + space < 800) return;
    page = new Page();
    pages.push(page);
    header(page, document, true);
    cursor = 80;
  };

  const renderSection = (category: 'GROCERY' | 'ALCOHOL') => {
    const lines = document.lines.filter((line) => line.orderCategory === category);
    if (!lines.length) return;
    const alcohol = category === 'ALCOHOL';
    const accent = alcohol ? RED : GREEN;
    const pale = alcohol ? RED_PALE : GREEN_PALE;
    ensure(90);
    page.rect(36, cursor, 523, 31, pale, LINE);
    page.text(alcohol ? 'ALCOHOL ITEMS (18+)' : 'GROCERY ITEMS', 48, cursor + 10, {
      size: 10,
      bold: true,
      colour: accent,
    });
    cursor += 31;
    page.rect(36, cursor, 523, 25, '#f8fafc', LINE);
    page.text('ITEM', 48, cursor + 8, { size: 7, bold: true, colour: MUTED });
    page.text('QTY', 364, cursor + 8, { size: 7, bold: true, colour: MUTED, align: 'right', width: 34 });
    page.text('UNIT PRICE', 405, cursor + 8, { size: 7, bold: true, colour: MUTED, align: 'right', width: 62 });
    page.text('TOTAL', 484, cursor + 8, { size: 7, bold: true, colour: MUTED, align: 'right', width: 63 });
    cursor += 25;
    for (const line of lines) {
      ensure(48);
      const names = wrap(line.productName, 49).slice(0, 2);
      const rowHeight = names.length > 1 ? 36 : 28;
      page.rect(36, cursor, 523, rowHeight, '#ffffff', LINE);
      names.forEach((name, index) =>
        page.text(name, 48, cursor + 8 + index * 12, { size: 8.5, bold: index === 0 }),
      );
      if (line.sku && names.length === 1)
        page.text(line.sku, 48, cursor + 20, { size: 6.5, colour: MUTED });
      page.text(String(line.quantity), 364, cursor + 10, { size: 8.5, align: 'right', width: 34 });
      const unitPrice = line.unitPriceMinor ?? line.lineTotalMinor / BigInt(Math.max(1, line.quantity));
      page.text(money(unitPrice, document.currency), 405, cursor + 10, { size: 8.5, align: 'right', width: 62 });
      page.text(money(line.lineTotalMinor, document.currency), 484, cursor + 10, { size: 8.5, bold: true, align: 'right', width: 63 });
      cursor += rowHeight;
    }
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0n);
    page.rect(36, cursor, 523, 30, pale, LINE);
    page.text(`${alcohol ? 'Alcohol' : 'Grocery'} subtotal`, 325, cursor + 9, {
      size: 9,
      bold: true,
      colour: accent,
      align: 'right',
      width: 142,
    });
    page.text(money(subtotal, document.currency), 484, cursor + 9, {
      size: 10,
      bold: true,
      colour: accent,
      align: 'right',
      width: 63,
    });
    cursor += 38;
  };

  renderSection('GROCERY');
  renderSection('ALCOHOL');

  const vat = new Map<number, bigint>();
  for (const line of document.lines)
    vat.set(line.vatRateBps, (vat.get(line.vatRateBps) ?? 0n) + line.vatAmountMinor);
  const rows: Array<[string, string]> = [
    ['Items subtotal', money(document.subtotalMinor, document.currency)],
    ...(document.discountMinor > 0n
      ? ([['Discount', `-${money(document.discountMinor, document.currency)}`]] as Array<[string, string]>)
      : []),
    ['Delivery charge', money(document.deliveryFeeMinor, document.currency)],
    ...[...vat.entries()].filter(([, amount]) => amount !== 0n).map(
      ([rate, amount]) =>
        [`VAT included at ${(rate / 100).toFixed(rate % 100 ? 2 : 0)}%`, money(amount, document.currency)] as [string, string],
    ),
  ];
  const summaryHeight = rows.length * 19 + 52;
  ensure(summaryHeight + 14);
  page.rect(281, cursor, 278, summaryHeight, '#ffffff', LINE);
  rows.forEach(([label, amount], index) => {
    page.text(label, 297, cursor + 13 + index * 19, { size: 8.5, colour: MUTED });
    page.text(amount, 468, cursor + 13 + index * 19, { size: 8.5, bold: true, align: 'right', width: 75 });
  });
  const totalTop = cursor + rows.length * 19 + 4;
  page.rule(297, totalTop, 543, totalTop);
  page.text('TOTAL PAID', 297, totalTop + 15, { size: 11, bold: true, colour: NAVY });
  page.text(money(document.totalMinor, document.currency), 451, totalTop + 11, {
    size: 16,
    bold: true,
    colour: GREEN,
    align: 'right',
    width: 92,
  });
  const hasAlcohol = document.lines.some((line) => line.orderCategory === 'ALCOHOL');
  if (hasAlcohol) {
    page.rect(36, cursor, 229, 52, RED_PALE, '#f4c3cc');
    page.text('AGE-RESTRICTED DELIVERY', 49, cursor + 10, { size: 8, bold: true, colour: RED });
    wrap('Challenge 25: valid photo ID may be required at delivery.', 42)
      .slice(0, 2)
      .forEach((line, index) => page.text(line, 49, cursor + 26 + index * 11, { size: 7.5, colour: RED }));
  }
  const thanksTop = cursor + (hasAlcohol ? 63 : 0);
  page.rect(36, thanksTop, 229, hasAlcohol ? 58 : summaryHeight, GREEN_PALE, '#b7dfcc');
  page.text('THANK YOU FOR YOUR ORDER', 36, thanksTop + (hasAlcohol ? 13 : 31), {
    size: 9.5,
    bold: true,
    colour: GREEN,
    align: 'center',
    width: 229,
  });
  page.text('Please keep this VAT invoice for your records.', 36, thanksTop + (hasAlcohol ? 32 : 51), {
    size: 7,
    colour: MUTED,
    align: 'center',
    width: 229,
  });

  pages.forEach((current, index) => {
    current.rule(36, 807, 559, 807);
    current.text(document.merchant.legalEntityName, 36, 815, { size: 6.5, colour: MUTED });
    const registration = [
      document.merchant.companyNumber ? `Company ${document.merchant.companyNumber}` : '',
      document.merchant.vatNumber ? `VAT ${document.merchant.vatNumber}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    current.text(registration, 205, 815, { size: 6.5, colour: MUTED, align: 'center', width: 220 });
    current.text(`Page ${index + 1} of ${pages.length}`, 489, 815, { size: 6.5, colour: MUTED, align: 'right', width: 70 });
  });
  return compile(pages);
}

export function renderTextPdf(lines: string[]): Buffer {
  const page = new Page();
  page.rect(0, 0, W, 34, NAVY);
  page.text('DOCUMENT', 36, 11, { size: 11, bold: true, colour: '#ffffff' });
  lines.forEach((line, index) => page.text(line, 40, 58 + index * 14, { size: 9 }));
  return compile([page]);
}
