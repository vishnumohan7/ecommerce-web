import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
const forbidden = new Set([
  'price',
  'priceMinor',
  'subtotal',
  'discount',
  'tax',
  'total',
  'deliveryFee',
  'isAlcohol',
  'orderCategory',
  'ageRestriction',
  'ageVerified',
  'stock',
]);
@Injectable()
export class ForbiddenFieldsPipe implements PipeTransform {
  transform(value: unknown): unknown {
    const found = this.find(value);
    if (found)
      throw new BadRequestException({
        code: 'CLIENT_SUPPLIED_SERVER_FIELD',
        message: `Field '${found}' is server-controlled`,
      });
    return value;
  }
  private find(value: unknown): string | undefined {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.find(item);
        if (found) return found;
      }
      return undefined;
    }
    if (typeof value !== 'object' || value === null) return undefined;
    for (const [key, child] of Object.entries(value)) {
      if (forbidden.has(key)) return key;
      const found = this.find(child);
      if (found) return found;
    }
    return undefined;
  }
}
