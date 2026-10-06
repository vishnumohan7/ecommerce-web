import { renderTextPdf } from './invoice.renderer';

export type AlcoholComplianceLine = {
  dispatchDate: Date;
  orderId: string;
  productName: string;
  quantity: number;
  lineTotalMinor: bigint;
  currency: string;
  recipientName: string;
  recipientAddress: unknown;
};

function csvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function renderAlcoholComplianceCsv(lines: AlcoholComplianceLine[]): string {
  return [
    'dispatchDate,orderId,productName,quantity,lineTotalMinor,currency,recipientName,address',
    ...lines.map((line) =>
      [
        line.dispatchDate.toISOString().slice(0, 10),
        line.orderId,
        csvCell(line.productName),
        String(line.quantity),
        line.lineTotalMinor.toString(),
        line.currency,
        csvCell(line.recipientName),
        csvCell(line.recipientAddress),
      ].join(','),
    ),
  ].join('\n');
}

export function renderAlcoholCompliancePdf(title: string, lines: AlcoholComplianceLine[]): Buffer {
  return renderTextPdf([
    title,
    'ALCOHOL DELIVERY RECORD — LICENSING ACT 2003 S.119',
    ...lines.flatMap((line) => [
      `DATE ${line.dispatchDate.toISOString().slice(0, 10)} | ORDER ${line.orderId}`,
      `${String(line.quantity)} x ${line.productName} | ${line.currency} ${line.lineTotalMinor.toString()} minor units`,
      `RECIPIENT ${line.recipientName} | ADDRESS ${JSON.stringify(line.recipientAddress)}`,
    ]),
    `TOTAL ALCOHOL LINES ${String(lines.length)}`,
  ]);
}
