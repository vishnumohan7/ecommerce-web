import { BadRequestException } from '@nestjs/common';

export interface SearchCursor {
  id: string;
  value: string | number;
}

export function encodeSearchCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeSearchCursor(value?: string): SearchCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<SearchCursor>;
    if (
      typeof parsed.id !== 'string' ||
      (typeof parsed.value !== 'string' && typeof parsed.value !== 'number')
    )
      throw new Error('invalid');
    return { id: parsed.id, value: parsed.value };
  } catch {
    throw new BadRequestException('Search cursor is invalid');
  }
}
