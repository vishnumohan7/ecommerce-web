export function renderTemplate(
  value: string | null | undefined,
  data: Record<string, unknown>,
): string {
  if (!value) return '';
  return value.replace(/{{\s*([\w.]+)\s*}}/g, (_match, path: string) => {
    let current: unknown = data;
    for (const part of path.split('.')) {
      if (!current || typeof current !== 'object') return '';
      current = (current as Record<string, unknown>)[part];
    }
    return current === null || current === undefined ? '' : String(current);
  });
}
