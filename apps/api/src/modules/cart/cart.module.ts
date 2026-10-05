import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { GuestCartTokenService } from './guest-cart-token.service';

@Module({
  controllers: [CartController],
  providers: [CartService, GuestCartTokenService],
  exports: [CartService, GuestCartTokenService],
})
export class CartModule {}
