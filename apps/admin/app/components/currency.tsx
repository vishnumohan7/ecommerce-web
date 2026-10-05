export function Currency({
  minor,
  currency = 'GBP',
}: Readonly<{ minor: string | number; currency?: string }>) {
  const value = Number(minor) / 100;
  return (
    <>
      {new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(
        Number.isFinite(value) ? value : 0,
      )}
    </>
  );
}
