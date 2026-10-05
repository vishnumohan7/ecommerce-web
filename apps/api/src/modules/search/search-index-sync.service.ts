import { Inject, Injectable } from '@nestjs/common';
import type { SearchHit, SearchProvider } from '@app/ports';
import { TOKENS } from '@app/ports';
// eslint-disable-next-line no-restricted-imports -- the worker must discover the tenant from the outbox row before tenant context exists
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class SearchIndexSyncService {
  constructor(
    @Inject(TOKENS.Search) private readonly provider: SearchProvider,
    private readonly prisma: PrismaService,
  ) {}

  async process(outboxMessageId: string): Promise<void> {
    const message = await this.prisma.outboxMessage.findUniqueOrThrow({
      where: { id: outboxMessageId },
    });
    const payload = message.payload as { productId?: string };
    if (!payload.productId || !message.topic.startsWith('search.product.'))
      throw new Error('Unsupported search outbox message');
    try {
      if (message.topic === 'search.product.delete')
        await this.provider.remove(message.tenantId, payload.productId);
      else await this.provider.upsert(await this.document(message.tenantId, payload.productId));
      await this.prisma.outboxMessage.update({
        where: { id: message.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
      });
    } catch (error) {
      await this.prisma.outboxMessage.update({
        where: { id: message.id },
        data: {
          status: 'PENDING',
          attempts: { increment: 1 },
          availableAt: new Date(Date.now() + 30_000),
        },
      });
      throw error;
    }
  }

  private async document(tenantId: string, productId: string): Promise<SearchHit> {
    const product = await this.prisma.product.findFirstOrThrow({
      where: { id: productId, tenantId },
    });
    const [category, brand, inventory, offer] = await Promise.all([
      this.prisma.category.findFirstOrThrow({ where: { id: product.categoryId, tenantId } }),
      product.brandId
        ? this.prisma.brand.findFirst({ where: { id: product.brandId, tenantId } })
        : null,
      this.prisma.inventory.count({ where: { tenantId, productId, stockAvailable: { gt: 0 } } }),
      this.prisma.promotionProduct.count({
        where: {
          tenantId,
          productId,
          promotionId: {
            in: (
              await this.prisma.promotion.findMany({
                where: {
                  tenantId,
                  active: true,
                  startsAt: { lte: new Date() },
                  endsAt: { gte: new Date() },
                },
                select: { id: true },
              })
            ).map((entry) => entry.id),
          },
        },
      }),
    ]);
    return {
      id: product.id,
      tenantId,
      status: product.status,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      description: product.description,
      categoryId: category.id,
      categoryName: category.name,
      brandId: brand?.id ?? null,
      brandName: brand?.name ?? null,
      priceMinor: product.priceMinor.toString(),
      currency: product.currency,
      isAlcohol: product.isAlcohol,
      abv: product.abv?.toFixed(2) ?? null,
      dietaryTags: product.dietaryTags,
      allergens: product.allergens,
      storageType: product.storageType,
      ratingAverageBps: product.ratingAverageBps,
      ratingCount: product.ratingCount,
      inStock: inventory > 0,
      onOffer: offer > 0,
      rank: 0,
    };
  }
}
