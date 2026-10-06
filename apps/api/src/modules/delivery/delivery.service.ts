import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type DeliveryZone, type StorageType } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { JurisdictionRuleService } from '../age-verification/jurisdiction-rule.service';
import {
  deliverySlotSchema,
  deliverySlotUpdateSchema,
  deliveryZoneSchema,
  deliveryZoneUpdateSchema,
} from './delivery.schemas';

export type DeliveryIdentity = { userId: string } | { guestSessionId: string };
type CombinationStrategy = 'MAX' | 'SUM' | 'GROCERY_ONLY' | 'HIGHEST_PLUS_SURCHARGE';

interface Basket {
  cartId: string;
  grocerySubtotalMinor: bigint;
  alcoholSubtotalMinor: bigint;
  totalMinor: bigint;
  storageTypes: StorageType[];
  hasAlcohol: boolean;
  hasAgeRestricted: boolean;
}

interface LockedSlot {
  id: string;
  capacity: number;
  reserved: number;
  active: boolean;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly jurisdictions: JurisdictionRuleService,
  ) {}

  async quote(identity: DeliveryIdentity, postcode: string) {
    const [zone, basket, settings] = await Promise.all([
      this.resolveZone(postcode),
      this.basket(identity),
      this.deliverySettings(),
    ]);
    this.validateZone(zone, basket);
    const scheduled = feeForSubtotal(zone, basket.totalMinor);
    const groceryFee =
      basket.grocerySubtotalMinor === 0n ||
      (zone.freeDeliveryThresholdMinor !== null &&
        basket.grocerySubtotalMinor >= zone.freeDeliveryThresholdMinor)
        ? 0n
        : scheduled.groceryFeeMinor;
    const alcoholFee = basket.alcoholSubtotalMinor === 0n ? 0n : scheduled.alcoholFeeMinor;
    const baseFee = combineDeliveryFees(
      groceryFee,
      alcoholFee,
      settings.strategy,
      settings.surchargeMinor,
    );
    return {
      zone: { id: zone.id, code: zone.code, name: zone.name },
      currency: zone.currency,
      deliveryFeeMinor: baseFee,
      breakdown: {
        strategy: settings.strategy,
        grocerySubtotalMinor: basket.grocerySubtotalMinor,
        alcoholSubtotalMinor: basket.alcoholSubtotalMinor,
        groceryFeeMinor: groceryFee,
        alcoholFeeMinor: alcoholFee,
        combinationSurchargeMinor:
          settings.strategy === 'HIGHEST_PLUS_SURCHARGE' ? settings.surchargeMinor : 0n,
      },
      basket: {
        grocerySubtotalMinor: basket.grocerySubtotalMinor,
        alcoholSubtotalMinor: basket.alcoholSubtotalMinor,
        totalMinor: basket.totalMinor,
        storageTypes: basket.storageTypes,
        hasAlcohol: basket.hasAlcohol,
        hasAgeRestricted: basket.hasAgeRestricted,
      },
    };
  }

  async availableSlots(identity: DeliveryIdentity, postcode: string, now = new Date()) {
    const quote = await this.quote(identity, postcode);
    const candidates = await this.db.client.deliverySlot.findMany({
      where: { zoneId: quote.zone.id, active: true, startsAt: { gt: now } },
      orderBy: { startsAt: 'asc' },
      take: 100,
    });
    const decisions = await Promise.all(
      candidates.map(async (slot) => ({
        slot,
        jurisdictionAllowed: await this.jurisdictions.isDeliveryTimeAllowed(
          postcode,
          slot.startsAt,
          quote.basket.hasAlcohol,
        ),
      })),
    );
    const slots = decisions
      .filter(
        ({ slot, jurisdictionAllowed }) =>
          jurisdictionAllowed &&
          slot.reserved < slot.capacity &&
          now.getTime() <= slot.startsAt.getTime() - slot.cutoffMinutes * 60_000 &&
          (!quote.basket.hasAgeRestricted || slot.allowsAgeRestricted),
      )
      .map(({ slot }) => ({
        ...slot,
        remainingCapacity: slot.capacity - slot.reserved,
        deliveryFeeMinor: quote.deliveryFeeMinor + slot.surchargeMinor,
      }));
    return { zone: quote.zone, breakdown: quote.breakdown, slots };
  }

  async reserve(identity: DeliveryIdentity, slotId: string, postcode: string, now = new Date()) {
    const basket = await this.basket(identity);
    const available = await this.availableSlots(identity, postcode, now);
    const slot = available.slots.find((candidate) => candidate.id === slotId);
    if (!slot)
      throw new UnprocessableEntityException({
        code: 'DELIVERY_SLOT_UNAVAILABLE',
        message: 'The selected slot is not available for this basket',
      });
    await this.reserveCapacity(basket.cartId, slotId);
    return { reserved: true, slotId, cartId: basket.cartId };
  }

  async reserveCapacity(cartId: string, slotId: string) {
    return this.db.transaction(async (tx, tenantId) => {
      const existing = await tx.deliverySlotReservation.findFirst({
        where: { tenantId, cartId },
      });
      if (existing?.slotId === slotId) return { reserved: true, slotId, cartId, idempotent: true };
      if (existing)
        throw new ConflictException({
          code: 'CART_SLOT_ALREADY_RESERVED',
          message: 'This cart already has a delivery-slot reservation',
        });
      const rows = await tx.$queryRaw<LockedSlot[]>`
        SELECT "id", "capacity", "reserved", "active"
        FROM "DeliverySlot"
        WHERE "tenantId" = ${tenantId}::uuid AND "id" = ${slotId}::uuid
        FOR UPDATE
      `;
      const current = rows[0];
      if (!current || !current.active || current.reserved >= current.capacity)
        throw new ConflictException({
          code: 'DELIVERY_SLOT_FULL',
          message: 'The selected delivery slot has no remaining capacity',
        });
      await tx.deliverySlot.update({
        where: { id: slotId, tenantId },
        data: { reserved: { increment: 1 } },
      });
      await tx.deliverySlotReservation.create({ data: { tenantId, slotId, cartId } });
      return { reserved: true, slotId, cartId, idempotent: false };
    });
  }

  zones() {
    return this.db.client.deliveryZone.findMany({ orderBy: { code: 'asc' } });
  }

  slots() {
    return this.db.client.deliverySlot.findMany({ orderBy: { startsAt: 'asc' } });
  }

  async createZone(raw: unknown) {
    const input = deliveryZoneSchema.parse(raw);
    return this.db.transaction(async (tx, tenantId) => {
      const created = await tx.deliveryZone.create({
        data: {
          tenantId,
          code: input.code,
          name: input.name,
          postcodePatterns: input.postcodePatterns,
          postcodeIncludes: input.postcodeIncludes,
          postcodeExcludes: input.postcodeExcludes,
          deliveryFeeMinor: BigInt(Math.max(input.groceryFeeMinor, input.alcoholFeeMinor)),
          groceryFeeMinor: BigInt(input.groceryFeeMinor),
          alcoholFeeMinor: BigInt(input.alcoholFeeMinor),
          ...(input.freeDeliveryThresholdMinor !== undefined
            ? { freeDeliveryThresholdMinor: toNullableBigInt(input.freeDeliveryThresholdMinor) }
            : {}),
          ...(input.minimumOrderMinor !== undefined
            ? { minimumOrderMinor: toNullableBigInt(input.minimumOrderMinor) }
            : {}),
          ...(input.maximumOrderMinor !== undefined
            ? { maximumOrderMinor: toNullableBigInt(input.maximumOrderMinor) }
            : {}),
          ...(input.alcoholMinimumSubtotalMinor !== undefined
            ? { alcoholMinimumSubtotalMinor: toNullableBigInt(input.alcoholMinimumSubtotalMinor) }
            : {}),
          feeSchedule: input.feeSchedule,
          supportedStorageTypes: input.supportedStorageTypes,
          currency: input.currency,
          alcoholDeliveryAllowed: input.alcoholDeliveryAllowed,
          active: input.active,
        },
      });
      await this.audit(tx, 'DELIVERY_ZONE_CREATED', created.id, null, created);
      return created;
    });
  }

  async updateZone(id: string, raw: unknown) {
    const input = deliveryZoneUpdateSchema.parse(raw);
    const current = await this.db.client.deliveryZone.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Delivery zone not found');
    const groceryFee = input.groceryFeeMinor ?? Number(current.groceryFeeMinor);
    const alcoholFee = input.alcoholFeeMinor ?? Number(current.alcoholFeeMinor);
    return this.db.transaction(async (tx, tenantId) => {
      const updated = await tx.deliveryZone.update({
        where: { id, tenantId },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.postcodePatterns !== undefined
            ? { postcodePatterns: input.postcodePatterns }
            : {}),
          ...(input.postcodeIncludes !== undefined
            ? { postcodeIncludes: input.postcodeIncludes }
            : {}),
          ...(input.postcodeExcludes !== undefined
            ? { postcodeExcludes: input.postcodeExcludes }
            : {}),
          ...(input.groceryFeeMinor !== undefined
            ? { groceryFeeMinor: BigInt(input.groceryFeeMinor) }
            : {}),
          ...(input.alcoholFeeMinor !== undefined
            ? { alcoholFeeMinor: BigInt(input.alcoholFeeMinor) }
            : {}),
          ...(input.freeDeliveryThresholdMinor !== undefined
            ? { freeDeliveryThresholdMinor: toNullableBigInt(input.freeDeliveryThresholdMinor) }
            : {}),
          ...(input.minimumOrderMinor !== undefined
            ? { minimumOrderMinor: toNullableBigInt(input.minimumOrderMinor) }
            : {}),
          ...(input.maximumOrderMinor !== undefined
            ? { maximumOrderMinor: toNullableBigInt(input.maximumOrderMinor) }
            : {}),
          ...(input.alcoholMinimumSubtotalMinor !== undefined
            ? { alcoholMinimumSubtotalMinor: toNullableBigInt(input.alcoholMinimumSubtotalMinor) }
            : {}),
          ...(input.feeSchedule !== undefined ? { feeSchedule: input.feeSchedule } : {}),
          ...(input.supportedStorageTypes !== undefined
            ? { supportedStorageTypes: input.supportedStorageTypes }
            : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.alcoholDeliveryAllowed !== undefined
            ? { alcoholDeliveryAllowed: input.alcoholDeliveryAllowed }
            : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          deliveryFeeMinor: BigInt(Math.max(groceryFee, alcoholFee)),
        },
      });
      await this.audit(tx, 'DELIVERY_ZONE_UPDATED', id, current, updated);
      return updated;
    });
  }

  async createSlot(raw: unknown) {
    const input = deliverySlotSchema.parse(raw);
    if (!(await this.db.client.deliveryZone.findFirst({ where: { id: input.zoneId } })))
      throw new NotFoundException('Delivery zone not found');
    return this.db.transaction(async (tx, tenantId) => {
      const created = await tx.deliverySlot.create({ data: { tenantId, ...input } });
      await this.audit(tx, 'DELIVERY_SLOT_CREATED', created.id, null, created);
      return created;
    });
  }

  async updateSlot(id: string, raw: unknown) {
    const input = deliverySlotUpdateSchema.parse(raw);
    const current = await this.db.client.deliverySlot.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Delivery slot not found');
    const startsAt = input.startsAt ?? current.startsAt;
    const endsAt = input.endsAt ?? current.endsAt;
    if (endsAt <= startsAt)
      throw new UnprocessableEntityException({
        code: 'INVALID_SLOT_WINDOW',
        message: 'Slot end must be after its start',
      });
    if (input.capacity !== undefined && input.capacity < current.reserved)
      throw new ConflictException({
        code: 'CAPACITY_BELOW_RESERVED',
        message: 'Capacity cannot be lower than current reservations',
      });
    return this.db.transaction(async (tx, tenantId) => {
      const updated = await tx.deliverySlot.update({
        where: { id, tenantId },
        data: {
          ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
          ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.surchargeMinor !== undefined
            ? { surchargeMinor: BigInt(input.surchargeMinor) }
            : {}),
          ...(input.cutoffMinutes !== undefined ? { cutoffMinutes: input.cutoffMinutes } : {}),
          ...(input.allowsAgeRestricted !== undefined
            ? { allowsAgeRestricted: input.allowsAgeRestricted }
            : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      await this.audit(tx, 'DELIVERY_SLOT_UPDATED', id, current, updated);
      return updated;
    });
  }

  private async resolveZone(postcode: string): Promise<DeliveryZone> {
    const normalized = normalizePostcode(postcode);
    const outward = normalized.slice(0, -3);
    if (outward.length < 2)
      throw new UnprocessableEntityException({
        code: 'ADDRESS_INVALID',
        message: 'Delivery postcode is invalid',
      });
    const zones = await this.db.client.deliveryZone.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });
    const zone = zones.find((candidate) => {
      if (candidate.postcodeExcludes.some((value) => postcodeMatches(value, normalized, outward)))
        return false;
      return (
        candidate.postcodeIncludes.some((value) => postcodeMatches(value, normalized, outward)) ||
        candidate.postcodePatterns.some((value) => postcodeMatches(value, normalized, outward))
      );
    });
    if (!zone)
      throw new UnprocessableEntityException({
        code: 'ADDRESS_NOT_DELIVERABLE',
        message: 'No delivery zone serves this postcode',
      });
    return zone;
  }

  private async basket(identity: DeliveryIdentity): Promise<Basket> {
    const owner =
      'userId' in identity ? { userId: identity.userId } : { guestToken: identity.guestSessionId };
    const cart = await this.db.client.cart.findFirst({ where: { ...owner, status: 'ACTIVE' } });
    if (!cart)
      throw new UnprocessableEntityException({
        code: 'CART_EMPTY',
        message: 'An active cart is required',
      });
    const items = await this.db.client.cartItem.findMany({ where: { cartId: cart.id } });
    if (items.length === 0)
      throw new UnprocessableEntityException({ code: 'CART_EMPTY', message: 'The cart is empty' });
    const products = await this.db.client.product.findMany({
      where: { id: { in: items.map((item) => item.productId) }, status: 'ACTIVE' },
      select: {
        id: true,
        priceMinor: true,
        isAlcohol: true,
        ageRestriction: true,
        storageType: true,
      },
    });
    if (products.length !== items.length)
      throw new UnprocessableEntityException({
        code: 'PRODUCT_UNAVAILABLE',
        message: 'A cart product is no longer active',
      });
    const byId = new Map(products.map((product) => [product.id, product]));
    let grocerySubtotalMinor = 0n;
    let alcoholSubtotalMinor = 0n;
    const storageTypes = new Set<StorageType>();
    let hasAgeRestricted = false;
    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) continue;
      const line = product.priceMinor * BigInt(item.quantity);
      if (product.isAlcohol) alcoholSubtotalMinor += line;
      else grocerySubtotalMinor += line;
      storageTypes.add(product.storageType);
      hasAgeRestricted ||= product.ageRestriction > 0;
    }
    return {
      cartId: cart.id,
      grocerySubtotalMinor,
      alcoholSubtotalMinor,
      totalMinor: grocerySubtotalMinor + alcoholSubtotalMinor,
      storageTypes: [...storageTypes],
      hasAlcohol: alcoholSubtotalMinor > 0n,
      hasAgeRestricted,
    };
  }

  private validateZone(zone: DeliveryZone, basket: Basket): void {
    if (zone.minimumOrderMinor !== null && basket.totalMinor < zone.minimumOrderMinor)
      throw rule('ORDER_BELOW_DELIVERY_MINIMUM', 'Basket is below the delivery-zone minimum');
    if (zone.maximumOrderMinor !== null && basket.totalMinor > zone.maximumOrderMinor)
      throw rule('ORDER_ABOVE_DELIVERY_MAXIMUM', 'Basket exceeds the delivery-zone maximum');
    const unsupported = basket.storageTypes.filter(
      (storage) => !zone.supportedStorageTypes.includes(storage),
    );
    if (unsupported.length > 0)
      throw rule(
        'STORAGE_TYPE_NOT_DELIVERABLE',
        'The zone cannot deliver every basket storage type',
        { unsupported },
      );
    if (basket.hasAlcohol && !zone.alcoholDeliveryAllowed)
      throw rule('ALCOHOL_DELIVERY_NOT_ALLOWED', 'Alcohol delivery is unavailable in this zone');
    if (
      basket.hasAlcohol &&
      zone.alcoholMinimumSubtotalMinor !== null &&
      basket.alcoholSubtotalMinor < zone.alcoholMinimumSubtotalMinor
    )
      throw rule('ALCOHOL_DELIVERY_MINIMUM_NOT_MET', 'Alcohol subtotal is below the zone minimum');
  }

  private async deliverySettings() {
    const record = await this.db.client.tenantSettings.findFirst();
    const delivery = (record?.settings as { delivery?: Record<string, unknown> } | undefined)
      ?.delivery;
    const rawStrategy = delivery?.combinationStrategy;
    const strategy: CombinationStrategy =
      rawStrategy === 'SUM' ||
      rawStrategy === 'GROCERY_ONLY' ||
      rawStrategy === 'HIGHEST_PLUS_SURCHARGE'
        ? rawStrategy
        : 'MAX';
    const rawSurcharge = delivery?.combinationSurchargeMinor;
    return {
      strategy,
      surchargeMinor:
        typeof rawSurcharge === 'number' && Number.isSafeInteger(rawSurcharge) && rawSurcharge >= 0
          ? BigInt(rawSurcharge)
          : 0n,
    };
  }

  private audit(
    tx: Prisma.TransactionClient,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        tenantId: TenantContext.requireTenantId(),
        actorId: TenantContext.get()?.userId ?? null,
        actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM',
        action,
        entity: action.includes('ZONE') ? 'DeliveryZone' : 'DeliverySlot',
        entityId,
        before: before === null ? Prisma.JsonNull : jsonValue(before),
        after: after === null ? Prisma.JsonNull : jsonValue(after),
        requestId: TenantContext.get()?.requestId ?? entityId,
      },
    });
  }
}

export function combineDeliveryFees(
  grocery: bigint,
  alcohol: bigint,
  strategy: CombinationStrategy,
  surcharge: bigint,
) {
  if (strategy === 'SUM') return grocery + alcohol;
  if (strategy === 'GROCERY_ONLY') return grocery;
  const highest = grocery > alcohol ? grocery : alcohol;
  return strategy === 'HIGHEST_PLUS_SURCHARGE' && grocery > 0n && alcohol > 0n
    ? highest + surcharge
    : highest;
}

function feeForSubtotal(zone: DeliveryZone, subtotal: bigint) {
  const tiers = Array.isArray(zone.feeSchedule)
    ? (zone.feeSchedule as Array<Record<string, unknown>>)
    : [];
  const selected = tiers
    .map((tier) => ({
      minimum: jsonMoney(tier.minimumSubtotalMinor),
      maximum:
        tier.maximumSubtotalMinor === null || tier.maximumSubtotalMinor === undefined
          ? null
          : jsonMoney(tier.maximumSubtotalMinor),
      grocery: jsonMoney(tier.groceryFeeMinor),
      alcohol: jsonMoney(tier.alcoholFeeMinor),
    }))
    .filter((tier) => tier.minimum !== null && tier.grocery !== null && tier.alcohol !== null)
    .sort((left, right) => Number((right.minimum ?? 0n) - (left.minimum ?? 0n)))
    .find(
      (tier) =>
        subtotal >= (tier.minimum ?? 0n) && (tier.maximum === null || subtotal <= tier.maximum),
    );
  return {
    groceryFeeMinor: selected?.grocery ?? zone.groceryFeeMinor,
    alcoholFeeMinor: selected?.alcohol ?? zone.alcoholFeeMinor,
  };
}

function jsonMoney(value: unknown): bigint | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function normalizePostcode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function postcodeMatches(pattern: string, full: string, outward: string): boolean {
  const normalized = normalizePostcode(pattern);
  if (pattern.trim().endsWith('*')) return outward.startsWith(normalized);
  return normalized === full || normalized === outward;
}

function toNullableBigInt(value: number | null): bigint | null {
  return value === null ? null : BigInt(value);
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, entry: unknown) =>
      typeof entry === 'bigint' ? entry.toString() : entry,
    ),
  ) as Prisma.InputJsonValue;
}

function rule(code: string, message: string, details?: Record<string, unknown>) {
  return new UnprocessableEntityException({ code, message, ...(details ? { details } : {}) });
}
