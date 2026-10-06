import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CmsPageType, Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { CartService } from '../cart/cart.service';
import {
  addressSchema,
  addressUpdateSchema,
  moveWishlistItemSchema,
  profileUpdateSchema,
  reviewCreateSchema,
  reviewModerationSchema,
  reviewUpdateSchema,
  wishlistItemSchema,
} from './customer.schemas';

@Injectable()
export class CustomerService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly carts: CartService,
  ) {}

  async profile() {
    return this.db.client.user.findFirstOrThrow({
      where: { id: this.userId(), active: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(raw: unknown) {
    const input = profileUpdateSchema.parse(raw);
    const existing = await this.db.client.user.findFirst({
      where: { id: this.userId(), active: true },
    });
    if (!existing) throw new NotFoundException('Profile not found');
    return this.db.client.user.update({
      where: { id: existing.id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  addresses() {
    return this.db.client.address.findMany({
      where: { userId: this.userId() },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(raw: unknown) {
    const input = addressSchema.parse(raw);
    const userId = this.userId();
    return this.db.transaction(async (tx, tenantId) => {
      const count = await tx.address.count({ where: { tenantId, userId } });
      const isDefault = input.isDefault || count === 0;
      if (isDefault)
        await tx.address.updateMany({
          where: { tenantId, userId, isDefault: true },
          data: { isDefault: false },
        });
      return tx.address.create({
        data: {
          tenantId,
          userId,
          label: input.label,
          line1: input.line1,
          ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
          city: input.city,
          postcode: input.postcode,
          country: input.country,
          isDefault,
        },
      });
    });
  }

  async updateAddress(id: string, raw: unknown) {
    const input = addressUpdateSchema.parse(raw);
    const userId = this.userId();
    return this.db.transaction(async (tx, tenantId) => {
      const address = await tx.address.findFirst({ where: { tenantId, id, userId } });
      if (!address) throw new NotFoundException('Address not found');
      if (input.isDefault)
        await tx.address.updateMany({
          where: { tenantId, userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      return tx.address.update({
        where: { id },
        data: {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.line1 !== undefined ? { line1: input.line1 } : {}),
          ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.postcode !== undefined ? { postcode: input.postcode } : {}),
          ...(input.country !== undefined ? { country: input.country } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
      });
    });
  }

  async deleteAddress(id: string) {
    const userId = this.userId();
    await this.db.transaction(async (tx, tenantId) => {
      const address = await tx.address.findFirst({ where: { tenantId, id, userId } });
      if (!address) throw new NotFoundException('Address not found');
      await tx.address.delete({ where: { id } });
      if (address.isDefault) {
        const replacement = await tx.address.findFirst({
          where: { tenantId, userId },
          orderBy: { createdAt: 'asc' },
        });
        if (replacement)
          await tx.address.update({ where: { id: replacement.id }, data: { isDefault: true } });
      }
    });
    return { deleted: true };
  }

  async wishlist() {
    const wishlist = await this.getOrCreateWishlist();
    const items = await this.db.client.wishlistItem.findMany({
      where: { wishlistId: wishlist.id },
      orderBy: { createdAt: 'desc' },
    });
    const products = await this.db.client.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      select: {
        id: true,
        slug: true,
        name: true,
        priceMinor: true,
        currency: true,
        status: true,
        isAlcohol: true,
        ageRestriction: true,
      },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    return {
      id: wishlist.id,
      items: items.map((item) => {
        const product = productById.get(item.productId);
        return {
          id: item.id,
          productId: item.productId,
          createdAt: item.createdAt,
          available: product?.status === 'ACTIVE',
          product: product ?? null,
        };
      }),
    };
  }

  async addWishlistItem(raw: unknown) {
    const { productId } = wishlistItemSchema.parse(raw);
    const product = await this.db.client.product.findFirst({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const wishlist = await this.getOrCreateWishlist();
    await this.db.client.wishlistItem.upsert({
      where: {
        tenantId_wishlistId_productId: {
          tenantId: TenantContext.requireTenantId(),
          wishlistId: wishlist.id,
          productId,
        },
      },
      update: {},
      create: { tenantId: TenantContext.requireTenantId(), wishlistId: wishlist.id, productId },
    });
    return this.wishlist();
  }

  async removeWishlistItem(productId: string) {
    const wishlist = await this.getOrCreateWishlist();
    const item = await this.db.client.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productId },
    });
    if (!item) throw new NotFoundException('Wishlist item not found');
    await this.db.client.wishlistItem.delete({ where: { id: item.id } });
    return this.wishlist();
  }

  async moveWishlistItem(productId: string, raw: unknown) {
    const input = moveWishlistItemSchema.parse(raw);
    const wishlist = await this.getOrCreateWishlist();
    const item = await this.db.client.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productId },
    });
    if (!item) throw new NotFoundException('Wishlist item not found');
    const product = await this.db.client.product.findFirst({
      where: { id: productId, status: 'ACTIVE' },
    });
    if (!product)
      throw new ConflictException({
        code: 'WISHLIST_PRODUCT_UNAVAILABLE',
        message: 'This wishlist item is currently unavailable',
      });
    const cart = await this.carts.add(
      { userId: this.userId() },
      { productId, quantity: input.quantity },
    );
    await this.db.client.wishlistItem.delete({ where: { id: item.id } });
    return { moved: true, cart };
  }

  async publicReviews(productId: string) {
    const product = await this.db.client.product.findFirst({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const reviews = await this.db.client.review.findMany({
      where: { productId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
    });
    const users = await this.db.client.user.findMany({
      where: { id: { in: reviews.map((review) => review.userId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userById = new Map(users.map((user) => [user.id, user]));
    return {
      productId,
      ratingAverageBps: product.ratingAverageBps,
      ratingCount: product.ratingCount,
      items: reviews.map((review) => {
        const user = userById.get(review.userId);
        return {
          id: review.id,
          productId: review.productId,
          rating: review.rating,
          title: review.title,
          body: review.body,
          imageUrls: review.imageUrls,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
          reviewer: user ? `${user.firstName} ${user.lastName.slice(0, 1)}.` : 'Verified customer',
        };
      }),
    };
  }

  myReviews() {
    return this.db.client.review.findMany({
      where: { userId: this.userId() },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReview(raw: unknown) {
    const input = reviewCreateSchema.parse(raw);
    const userId = this.userId();
    const product = await this.db.client.product.findFirst({ where: { id: input.productId } });
    if (!product) throw new NotFoundException('Product not found');
    const existing = await this.db.client.review.findFirst({
      where: { userId, productId: input.productId },
    });
    if (existing) throw new ConflictException('You have already reviewed this product');
    const orderItems = await this.db.client.orderItem.findMany({
      where: { productId: input.productId },
      select: { orderId: true },
    });
    const order = await this.db.client.order.findFirst({
      where: {
        id: { in: orderItems.map((item) => item.orderId) },
        userId,
        paymentStatus: 'CAPTURED',
        fulfilmentStatus: 'DELIVERED',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!order)
      throw new UnprocessableEntityException({
        code: 'REVIEW_NOT_ELIGIBLE',
        message: 'A delivered verified purchase is required to review this product',
      });
    return this.db.client.review.create({
      data: {
        tenantId: TenantContext.requireTenantId(),
        userId,
        orderId: order.id,
        productId: input.productId,
        rating: input.rating,
        ...(input.title !== undefined ? { title: input.title } : {}),
        body: input.body,
        imageUrls: input.imageUrls,
        status: 'PENDING',
      },
    });
  }

  async updateReview(id: string, raw: unknown) {
    const input = reviewUpdateSchema.parse(raw);
    const review = await this.ownedReview(id);
    const updated = await this.db.client.review.update({
      where: { id: review.id },
      data: {
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.imageUrls !== undefined ? { imageUrls: input.imageUrls } : {}),
        status: 'PENDING',
        moderationReason: null,
        moderatedById: null,
        moderatedAt: null,
      },
    });
    if (review.status === 'APPROVED') await this.recalculateRating(review.productId);
    return updated;
  }

  async deleteReview(id: string) {
    const review = await this.ownedReview(id);
    await this.db.client.review.delete({ where: { id: review.id } });
    if (review.status === 'APPROVED') await this.recalculateRating(review.productId);
    return { deleted: true };
  }

  async moderateReview(id: string, raw: unknown) {
    const input = reviewModerationSchema.parse(raw);
    const review = await this.db.client.review.findFirst({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    const updated = await this.db.client.review.update({
      where: { id },
      data: {
        status: input.status,
        moderationReason: input.reason ?? null,
        moderatedById: this.userId(),
        moderatedAt: new Date(),
      },
    });
    await this.recalculateRating(review.productId);
    return updated;
  }

  async homeContent() {
    const now = new Date();
    const schedule = {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    } satisfies Prisma.BannerWhereInput;
    const [banners, blocks] = await Promise.all([
      this.db.client.banner.findMany({ where: schedule, orderBy: { position: 'asc' } }),
      this.db.client.cmsContentBlock.findMany({
        where: schedule,
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    return { banners, blocks };
  }

  legalContent(type: string, locale = 'en-GB') {
    const normalised = type.trim().toUpperCase().replaceAll('-', '_');
    if (!Object.values(CmsPageType).includes(normalised as CmsPageType))
      throw new NotFoundException('Content page not found');
    return this.db.client.cmsPage
      .findFirst({ where: { type: normalised as CmsPageType, locale, published: true } })
      .then((page) => {
        if (!page) throw new NotFoundException('Content page not found');
        return page;
      });
  }

  private async getOrCreateWishlist() {
    const userId = this.userId();
    const tenantId = TenantContext.requireTenantId();
    return this.db.client.wishlist.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: {},
      create: { tenantId, userId },
    });
  }

  private async ownedReview(id: string) {
    const review = await this.db.client.review.findFirst({ where: { id, userId: this.userId() } });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  private async recalculateRating(productId: string) {
    const aggregate = await this.db.client.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await this.db.client.product.update({
      where: { id: productId },
      data: {
        ratingCount: aggregate._count.rating,
        ratingAverageBps: Math.round((aggregate._avg.rating ?? 0) * 2000),
      },
    });
  }

  private userId(): string {
    const userId = TenantContext.get()?.userId;
    if (!userId) throw new UnauthorizedException('Authenticated user context is unavailable');
    return userId;
  }
}
