import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, RequirePermissions } from '../../common/auth/auth.decorators';
import { CustomerService } from './customer.service';

@ApiTags('Customer account')
@ApiBearerAuth()
@Controller('api/v1')
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Get('profile')
  @RequirePermissions('catalog.read')
  profile() {
    return this.customers.profile();
  }

  @Patch('profile')
  @RequirePermissions('catalog.read')
  updateProfile(@Body() body: unknown) {
    return this.customers.updateProfile(body);
  }

  @Get('addresses')
  @RequirePermissions('catalog.read')
  addresses() {
    return this.customers.addresses();
  }

  @Post('addresses')
  @RequirePermissions('catalog.read')
  createAddress(@Body() body: unknown) {
    return this.customers.createAddress(body);
  }

  @Patch('addresses/:id')
  @RequirePermissions('catalog.read')
  updateAddress(@Param('id') id: string, @Body() body: unknown) {
    return this.customers.updateAddress(id, body);
  }

  @Delete('addresses/:id')
  @RequirePermissions('catalog.read')
  deleteAddress(@Param('id') id: string) {
    return this.customers.deleteAddress(id);
  }

  @Get('wishlist')
  @RequirePermissions('catalog.read')
  wishlist() {
    return this.customers.wishlist();
  }

  @Post('wishlist/items')
  @RequirePermissions('catalog.read')
  addWishlistItem(@Body() body: unknown) {
    return this.customers.addWishlistItem(body);
  }

  @Delete('wishlist/items/:productId')
  @RequirePermissions('catalog.read')
  removeWishlistItem(@Param('productId') productId: string) {
    return this.customers.removeWishlistItem(productId);
  }

  @Post('wishlist/items/:productId/move-to-cart')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Move an available wishlist product into the active cart' })
  moveWishlistItem(@Param('productId') productId: string, @Body() body: unknown) {
    return this.customers.moveWishlistItem(productId, body);
  }

  @Public()
  @Get('reviews')
  @ApiOperation({ summary: 'List approved product reviews' })
  reviews(@Query('productId') productId: string) {
    return this.customers.publicReviews(productId);
  }

  @Get('reviews/mine')
  @RequirePermissions('catalog.read')
  myReviews() {
    return this.customers.myReviews();
  }

  @Post('reviews')
  @RequirePermissions('catalog.read')
  createReview(@Body() body: unknown) {
    return this.customers.createReview(body);
  }

  @Patch('reviews/:id')
  @RequirePermissions('catalog.read')
  updateReview(@Param('id') id: string, @Body() body: unknown) {
    return this.customers.updateReview(id, body);
  }

  @Delete('reviews/:id')
  @RequirePermissions('catalog.read')
  deleteReview(@Param('id') id: string) {
    return this.customers.deleteReview(id);
  }

  @Patch('admin/reviews/:id/moderation')
  @RequirePermissions('catalog.write')
  @ApiOperation({ summary: 'Approve or reject a verified-purchase review' })
  moderateReview(@Param('id') id: string, @Body() body: unknown) {
    return this.customers.moderateReview(id, body);
  }

  @Public()
  @Get('content/home')
  homeContent() {
    return this.customers.homeContent();
  }

  @Public()
  @Get('content/legal/:type')
  legalContent(@Param('type') type: string, @Query('locale') locale?: string) {
    return this.customers.legalContent(type, locale);
  }
}
