import { Injectable, NotFoundException } from '@nestjs/common';
import type { Jurisdiction, JurisdictionRuleset } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';

export interface ResolvedJurisdiction {
  jurisdiction: Jurisdiction;
  rules: JurisdictionRuleset;
}

@Injectable()
export class PostcodeJurisdictionResolver {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async resolve(postcode: string): Promise<ResolvedJurisdiction> {
    const area = postcodeArea(postcode);
    const jurisdictions = await this.db.client.jurisdiction.findMany({ where: { active: true } });
    const jurisdiction =
      jurisdictions.find((candidate) => candidate.postcodeAreas.includes(area)) ??
      jurisdictions.find((candidate) => candidate.code === 'ENGLAND_WALES');
    if (!jurisdiction) throw new NotFoundException('No active jurisdiction rules exist');
    const rules = await this.db.client.jurisdictionRuleset.findFirst({
      where: { jurisdictionId: jurisdiction.id },
    });
    if (!rules) throw new NotFoundException('Jurisdiction ruleset is unavailable');
    return { jurisdiction, rules };
  }
}

@Injectable()
export class JurisdictionRuleService {
  constructor(private readonly resolver: PostcodeJurisdictionResolver) {}

  async saleDecision(postcode: string, at: Date) {
    const resolved = await this.resolver.resolve(postcode);
    const minute = londonMinute(at);
    const allowed = withinWindow(
      minute,
      resolved.rules.permittedSaleStartMinutes,
      resolved.rules.permittedSaleEndMinutes,
    );
    return {
      ...resolved,
      allowed,
      reopensAt: allowed
        ? null
        : nextLondonMinute(at, resolved.rules.permittedSaleStartMinutes).toISOString(),
    };
  }

  async isDeliveryTimeAllowed(postcode: string, startsAt: Date, alcoholBasket: boolean) {
    if (!alcoholBasket) return true;
    const { rules } = await this.resolver.resolve(postcode);
    if (
      rules.prohibitedDeliveryStartMinutes === null ||
      rules.prohibitedDeliveryEndMinutes === null
    )
      return true;
    return !withinWindow(
      londonMinute(startsAt),
      rules.prohibitedDeliveryStartMinutes,
      rules.prohibitedDeliveryEndMinutes,
    );
  }
}

export function postcodeArea(postcode: string): string {
  const normalized = postcode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = /^([A-Z]{1,2})\d/.exec(normalized);
  if (!match?.[1]) throw new NotFoundException('Delivery postcode is invalid');
  return match[1];
}

function londonMinute(value: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function withinWindow(minute: number, start: number, end: number): boolean {
  if (start === 0 && end === 1440) return true;
  if (start === end) return true;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

function nextLondonMinute(value: Date, targetMinute: number): Date {
  const start = new Date(value);
  start.setUTCSeconds(0, 0);
  for (let offset = 1; offset <= 60 * 48; offset += 1) {
    const candidate = new Date(start.getTime() + offset * 60_000);
    if (londonMinute(candidate) === targetMinute) return candidate;
  }
  throw new Error('Unable to resolve the next permitted sale window');
}
