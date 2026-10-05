import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ImageService } from '../src/modules/catalog/image.service';

const service = new ImageService({} as never, {} as never);

describe('catalog image security', () => {
  it('identifies allowed formats from magic bytes rather than filenames', () => {
    expect(service.detect(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(service.detect(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(service.detect(Buffer.from('not an image'))).toBeUndefined();
  });

  it('rejects unsupported bytes before storage or database access', async () => {
    await expect(service.upload('product', Buffer.from('<script>alert(1)</script>'), 'Unsafe')).rejects.toBeInstanceOf(BadRequestException);
  });
});
