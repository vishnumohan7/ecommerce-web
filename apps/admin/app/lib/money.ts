export function minorToGbp(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '';
  return (Number(value) / 100).toFixed(2);
}

export function gbpToMinor(value: string) {
  const amount = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) return amount;
  const pounds = match[1] ?? '0';
  const pence = (match[2] ?? '').padEnd(2, '0');
  return `${pounds}${pence}`.replace(/^0+(?=\d)/, '');
}
