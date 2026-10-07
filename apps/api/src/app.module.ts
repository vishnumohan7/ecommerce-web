import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/auth/auth.guard';
import { AuthModule } from './common/auth/auth.module';
import { ConfigModule } from './common/config/config.module';
import { CoreModule } from './common/core.module';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { TurnstileGuard } from './common/security/turnstile.guard';
import { LicensingModule } from './common/licensing/licensing.module';
import { DatabaseModule } from './common/database/database.module';
import { TenantContextMiddleware } from './common/tenancy/tenant-context.middleware';
import { HealthController } from './health.controller';
import { StorageModule } from './common/storage/storage.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CatalogImportModule } from './modules/import/catalog-import.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { SearchModule } from './modules/search/search.module';
import { CartModule } from './modules/cart/cart.module';
import { AgeVerificationModule } from './modules/age-verification/age-verification.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { PaymentModule } from './modules/payments/payment.module';
import { OrderModule } from './modules/orders/order.module';
import { ReturnModule } from './modules/returns/return.module';
import { CustomerModule } from './modules/customer/customer.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { AdminModule } from './modules/admin/admin.module';
import { PrivacyModule } from './modules/privacy/privacy.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LicensingModule,
    CoreModule,
    AuthModule,
    StorageModule,
    CatalogModule,
    InventoryModule,
    CatalogImportModule,
    PromotionsModule,
    SearchModule,
    CartModule,
    AgeVerificationModule,
    DeliveryModule,
    PricingModule,
    CheckoutModule,
    PaymentModule,
    OrderModule,
    ReturnModule,
    CustomerModule,
    NotificationModule,
    AdminModule,
    PrivacyModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useExisting: RateLimitGuard },
    { provide: APP_GUARD, useExisting: TurnstileGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
