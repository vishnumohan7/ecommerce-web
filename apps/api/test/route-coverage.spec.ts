import { PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { AuthController } from '../src/common/auth/auth.controller';
import { PUBLIC_ROUTE, REQUIRED_PERMISSIONS } from '../src/common/auth/auth.decorators';
import { MetricsController } from '../src/common/metrics/metrics.controller';
import { HealthController } from '../src/health.controller';
import { CatalogController } from '../src/modules/catalog/catalog.controller';
import { ImageController } from '../src/modules/catalog/image.controller';
import { CatalogImportController } from '../src/modules/import/catalog-import.controller';
import { InventoryController } from '../src/modules/inventory/inventory.controller';
import { PromotionsController } from '../src/modules/promotions/promotions.controller';
import { SearchController } from '../src/modules/search/search.controller';
import { CartController } from '../src/modules/cart/cart.controller';
import { AgeVerificationController } from '../src/modules/age-verification/age-verification.controller';
import { DeliveryController } from '../src/modules/delivery/delivery.controller';
import { TaxonomyController } from '../src/modules/catalog/taxonomy.controller';
import { PricingController } from '../src/modules/pricing/pricing.controller';
import { CheckoutController } from '../src/modules/checkout/checkout.controller';
import { PaymentController } from '../src/modules/payments/payment.controller';

describe('route coverage', () => {
  it('requires every route to be public or permission-protected', () => {
    const missing: string[] = [];
    for (const controller of [
      AuthController,
      HealthController,
      MetricsController,
      CatalogController,
      ImageController,
      CatalogImportController,
      InventoryController,
      PromotionsController,
      SearchController,
      CartController,
      AgeVerificationController,
      DeliveryController,
      TaxonomyController,
      PricingController,
      CheckoutController,
      PaymentController,
    ]) {
      for (const methodName of Object.getOwnPropertyNames(controller.prototype).filter(
        (name) => name !== 'constructor',
      )) {
        const handler = Object.getOwnPropertyDescriptor(controller.prototype, methodName)?.value as
          object | undefined;
        if (!handler || Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
        const publicRoute =
          Reflect.getMetadata(PUBLIC_ROUTE, handler) === true ||
          Reflect.getMetadata(PUBLIC_ROUTE, controller) === true;
        const permissions = (Reflect.getMetadata(REQUIRED_PERMISSIONS, handler) ??
          Reflect.getMetadata(REQUIRED_PERMISSIONS, controller)) as string[] | undefined;
        if (!publicRoute && (!permissions || permissions.length === 0))
          missing.push(`${controller.name}.${methodName}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
