import { describe, expect, it } from 'vitest';
import { readableApiError } from './error-message';

describe('readableApiError', () => {
  it('renders nested API messages instead of object coercion', () => {
    expect(
      readableApiError(
        { message: { code: 'VALIDATION_FAILED', details: ['End date must be after start date'] } },
        422,
      ),
    ).toBe('End date must be after start date');
  });

  it('joins validation message arrays', () => {
    expect(readableApiError({ message: ['Name is required', 'Type is invalid'] }, 400)).toBe(
      'Name is required Type is invalid',
    );
  });

  it('falls back to the response status', () => {
    expect(readableApiError({ code: 'UNKNOWN' }, 500)).toBe('API returned 500.');
  });
});
