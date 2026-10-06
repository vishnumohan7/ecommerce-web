import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { PaymentModule } from '../payments/payment.module';
import { ReturnModule } from '../returns/return.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [CartModule, PaymentModule, ReturnModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
