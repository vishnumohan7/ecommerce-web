import { readFileSync } from 'node:fs';

const schema = readFileSync('apps/api/prisma/schema.prisma', 'utf8');
const moneyName = /price|amount|total|fee|discount|tax|subtotal/i;
const violations = schema.split('\n').flatMap((line, index) => {
  const field = /^\s*(\w+)\s+(Float|Decimal)\??\b/.exec(line);
  return field && moneyName.test(field[1] ?? '') ? [`${index + 1}: ${line.trim()}`] : [];
});
if (violations.length > 0) {
  console.error(`Monetary fields must use BigInt minor units:\n${violations.join('\n')}`);
  process.exit(1);
}
console.log('Prisma money-field lint passed.');
