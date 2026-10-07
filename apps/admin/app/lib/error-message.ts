function collectMessages(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (value === null || value === undefined || seen.has(value)) return [];

  if (Array.isArray(value)) {
    seen.add(value);
    return value.flatMap((item) => collectMessages(item, seen));
  }

  if (typeof value === 'object') {
    seen.add(value);
    const record = value as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail', 'details', 'reason']) {
      const messages = collectMessages(record[key], seen);
      if (messages.length > 0) return messages;
    }
  }

  return [];
}

export function readableApiError(payload: unknown, status: number): string {
  const messages = collectMessages(payload);
  return messages.length > 0
    ? [...new Set(messages)].join(' ')
    : `API returned ${String(status)}.`;
}
