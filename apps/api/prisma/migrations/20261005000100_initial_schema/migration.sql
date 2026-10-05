-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'CATALOG_MANAGER', 'FULFILMENT_STAFF', 'DRIVER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('UNIT', 'WEIGHT_ESTIMATED');

-- CreateEnum
CREATE TYPE "ReturnPolicy" AS ENUM ('STANDARD_14_DAY', 'PERISHABLE_EXEMPT', 'AGE_RESTRICTED_RESTRICTED', 'NON_RETURNABLE');

-- CreateEnum
CREATE TYPE "HfssStatus" AS ENUM ('NOT_IN_SCOPE', 'IN_SCOPE');

-- CreateEnum
CREATE TYPE "RestrictionReason" AS ENUM ('NONE', 'ALCOHOL', 'KNIFE', 'TOBACCO', 'VAPE', 'SOLVENT', 'ENERGY_DRINK', 'LOTTERY', 'RETAILER_POLICY');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubstitutionPreference" AS ENUM ('NO_SUB', 'SIMILAR', 'ANY');

-- CreateEnum
CREATE TYPE "BasketType" AS ENUM ('GROCERY', 'ALCOHOL', 'MIXED');

-- CreateEnum
CREATE TYPE "OrderCategory" AS ENUM ('GROCERY', 'ALCOHOL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'AUTHORISED', 'CAPTURED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FulfilmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PICKING', 'PICKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REFUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING', 'PARTIAL', 'FULL', 'FAILED');

-- CreateEnum
CREATE TYPE "AgeVerificationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PASSED', 'FAILED', 'EXPIRED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "DeliveryAgeCheckStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PASSED', 'FAILED', 'REFUSED');

-- CreateEnum
CREATE TYPE "VerificationOutcome" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED', 'MULTIBUY', 'FREE_DELIVERY');

-- CreateEnum
CREATE TYPE "PickListStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubstitutionStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "LicenseEdition" AS ENUM ('STANDARD', 'PRO');

-- CreateEnum
CREATE TYPE "CmsPageType" AS ENUM ('TERMS', 'PRIVACY', 'COOKIE', 'RETURNS', 'ALCOHOL_POLICY', 'DELIVERY_POLICY');

-- CreateEnum
CREATE TYPE "JurisdictionCode" AS ENUM ('ENGLAND_WALES', 'SCOTLAND', 'NORTHERN_IRELAND');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "settings" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandingProfile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "brandName" TEXT NOT NULL,
    "legalEntityName" TEXT NOT NULL,
    "companyNumber" TEXT,
    "vatNumber" TEXT,
    "registeredAddress" JSONB NOT NULL,
    "assets" JSONB NOT NULL,
    "colours" JSONB NOT NULL,
    "typography" JSONB NOT NULL,
    "emailBranding" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" "CmsPageType" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en-GB',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tombstonedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'GB',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurisdiction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" "JurisdictionCode" NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JurisdictionRuleset" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "jurisdictionId" UUID NOT NULL,
    "permittedSaleStartMinutes" INTEGER NOT NULL,
    "permittedSaleEndMinutes" INTEGER NOT NULL,
    "prohibitedDeliveryStartMinutes" INTEGER,
    "prohibitedDeliveryEndMinutes" INTEGER,
    "challengeAge" INTEGER NOT NULL,
    "requiresDayBook" BOOLEAN NOT NULL DEFAULT false,
    "requiresDriverManifest" BOOLEAN NOT NULL DEFAULT false,
    "allowsDigitalProofOfAge" BOOLEAN NOT NULL DEFAULT false,
    "hfssEnforced" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JurisdictionRuleset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "parentId" UUID,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "brandId" UUID,
    "sku" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "priceMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "vatRateBps" INTEGER NOT NULL,
    "pricingMode" "PricingMode" NOT NULL DEFAULT 'UNIT',
    "pricePerKgMinor" BIGINT,
    "estimatedWeightGrams" INTEGER,
    "weightToleranceBps" INTEGER,
    "isAlcohol" BOOLEAN NOT NULL DEFAULT false,
    "abvBps" INTEGER,
    "ageRestriction" INTEGER NOT NULL DEFAULT 0,
    "restrictionReason" "RestrictionReason" NOT NULL DEFAULT 'NONE',
    "returnPolicy" "ReturnPolicy" NOT NULL,
    "unitPriceDisplay" TEXT NOT NULL,
    "hfssStatus" "HfssStatus" NOT NULL DEFAULT 'NOT_IN_SCOPE',
    "hfssCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "onHand" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "guestToken" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "version" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "substitutionPreference" "SubstitutionPreference" NOT NULL DEFAULT 'SIMILAR',
    "acknowledgedPriceMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgeVerification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "guestToken" TEXT,
    "provider" TEXT NOT NULL,
    "providerSessionId" TEXT NOT NULL,
    "outcome" "VerificationOutcome" NOT NULL,
    "verifiedAgeOver" INTEGER,
    "method" TEXT,
    "providerReference" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgeVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postcodePatterns" TEXT[],
    "deliveryFeeMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "alcoholDeliveryAllowed" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverySlot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "valueBps" INTEGER,
    "valueMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "minimumSpendMinor" BIGINT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "promotionId" UUID NOT NULL,
    "conditions" JSONB NOT NULL,
    "effect" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultibuyGroup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "promotionId" UUID NOT NULL,
    "productIds" UUID[],
    "buyQuantity" INTEGER NOT NULL,
    "payQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MultibuyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "orderNumber" BIGINT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "basketType" "BasketType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "subtotalMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL,
    "deliveryFeeMinor" BIGINT NOT NULL,
    "totalMinor" BIGINT NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "fulfilmentStatus" "FulfilmentStatus" NOT NULL DEFAULT 'PENDING',
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE',
    "ageVerificationStatus" "AgeVerificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "deliveryAgeCheckStatus" "DeliveryAgeCheckStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "deliveryAddress" JSONB NOT NULL,
    "deliverySlotId" UUID,
    "customerSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "vatRateBps" INTEGER NOT NULL,
    "vatAmountMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL,
    "lineTotalMinor" BIGINT NOT NULL,
    "orderCategory" "OrderCategory" NOT NULL,
    "isAlcohol" BOOLEAN NOT NULL,
    "ageRestriction" INTEGER NOT NULL,
    "abvBps" INTEGER,
    "pricingMode" "PricingMode" NOT NULL,
    "estimatedWeightGrams" INTEGER,
    "actualWeightGrams" INTEGER,
    "unitPriceDisplay" TEXT NOT NULL,
    "hfssStatus" "HfssStatus" NOT NULL,
    "returnPolicy" "ReturnPolicy" NOT NULL,
    "substitutionPreference" "SubstitutionPreference" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentIntentId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "authorisedAmountMinor" BIGINT NOT NULL,
    "capturedAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "refundedAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "manualCapture" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "invoiceNumber" BIGINT NOT NULL,
    "subtotalMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL,
    "totalMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "documentUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "providerRefundId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickList" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "assignedToId" UUID,
    "status" "PickListStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickListItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "pickListId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "requested" INTEGER NOT NULL,
    "picked" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PickListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Substitution" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "substituteProductId" UUID NOT NULL,
    "status" "SubstitutionStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposedPriceMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Substitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightCapture" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "grams" INTEGER NOT NULL,
    "capturedById" UUID NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB,
    "statusCode" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "licenseId" TEXT NOT NULL,
    "edition" "LicenseEdition" NOT NULL,
    "seats" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "features" TEXT[],
    "tokenHash" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlagOverride" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlagOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlcoholDayBookEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "dispatchDate" DATE NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotalMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientAddress" JSONB NOT NULL,
    "immutableHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlcoholDayBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverManifest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "orderIds" UUID[],
    "pdfUrl" TEXT,
    "csvUrl" TEXT,
    "immutableHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceCapEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "authorisedAmountMinor" BIGINT NOT NULL,
    "recomputedAmountMinor" BIGINT NOT NULL,
    "capturedAmountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCapEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorId" UUID,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "requestId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "transactionalEmail" BOOLEAN NOT NULL DEFAULT true,
    "transactionalSms" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmail" BOOLEAN NOT NULL DEFAULT false,
    "marketingSms" BOOLEAN NOT NULL DEFAULT false,
    "consentVersion" TEXT,
    "consentedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- CreateIndex
CREATE INDEX "TenantSettings_tenantId_idx" ON "TenantSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandingProfile_tenantId_key" ON "BrandingProfile"("tenantId");

-- CreateIndex
CREATE INDEX "BrandingProfile_tenantId_idx" ON "BrandingProfile"("tenantId");

-- CreateIndex
CREATE INDEX "CmsPage_tenantId_idx" ON "CmsPage"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_tenantId_type_locale_key" ON "CmsPage"("tenantId", "type", "locale");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Address_tenantId_userId_idx" ON "Address"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Address_tenantId_postcode_idx" ON "Address"("tenantId", "postcode");

-- CreateIndex
CREATE INDEX "Jurisdiction_tenantId_idx" ON "Jurisdiction"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Jurisdiction_tenantId_code_key" ON "Jurisdiction"("tenantId", "code");

-- CreateIndex
CREATE INDEX "JurisdictionRuleset_tenantId_idx" ON "JurisdictionRuleset"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "JurisdictionRuleset_tenantId_jurisdictionId_key" ON "JurisdictionRuleset"("tenantId", "jurisdictionId");

-- CreateIndex
CREATE INDEX "Category_tenantId_parentId_idx" ON "Category"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_slug_key" ON "Category"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Brand_tenantId_idx" ON "Brand"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_tenantId_slug_key" ON "Brand"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Product_tenantId_categoryId_status_idx" ON "Product"("tenantId", "categoryId", "status");

-- CreateIndex
CREATE INDEX "Product_tenantId_brandId_idx" ON "Product"("tenantId", "brandId");

-- CreateIndex
CREATE INDEX "Product_tenantId_name_idx" ON "Product"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_slug_key" ON "Product"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "ProductImage_tenantId_productId_idx" ON "ProductImage"("tenantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_tenantId_productId_position_key" ON "ProductImage"("tenantId", "productId", "position");

-- CreateIndex
CREATE INDEX "Inventory_tenantId_productId_idx" ON "Inventory"("tenantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_tenantId_productId_warehouseId_key" ON "Inventory"("tenantId", "productId", "warehouseId");

-- CreateIndex
CREATE INDEX "Warehouse_tenantId_idx" ON "Warehouse"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_tenantId_code_key" ON "Warehouse"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Cart_tenantId_userId_status_idx" ON "Cart"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "Cart_tenantId_guestToken_status_idx" ON "Cart"("tenantId", "guestToken", "status");

-- CreateIndex
CREATE INDEX "CartItem_tenantId_cartId_idx" ON "CartItem"("tenantId", "cartId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_tenantId_cartId_productId_key" ON "CartItem"("tenantId", "cartId", "productId");

-- CreateIndex
CREATE INDEX "AgeVerification_tenantId_userId_outcome_idx" ON "AgeVerification"("tenantId", "userId", "outcome");

-- CreateIndex
CREATE INDEX "AgeVerification_tenantId_guestToken_outcome_idx" ON "AgeVerification"("tenantId", "guestToken", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "AgeVerification_tenantId_provider_providerSessionId_key" ON "AgeVerification"("tenantId", "provider", "providerSessionId");

-- CreateIndex
CREATE INDEX "DeliveryZone_tenantId_active_idx" ON "DeliveryZone"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZone_tenantId_code_key" ON "DeliveryZone"("tenantId", "code");

-- CreateIndex
CREATE INDEX "DeliverySlot_tenantId_zoneId_startsAt_idx" ON "DeliverySlot"("tenantId", "zoneId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliverySlot_tenantId_zoneId_startsAt_endsAt_key" ON "DeliverySlot"("tenantId", "zoneId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Coupon_tenantId_active_startsAt_endsAt_idx" ON "Coupon"("tenantId", "active", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_tenantId_code_key" ON "Coupon"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Promotion_tenantId_active_startsAt_endsAt_idx" ON "Promotion"("tenantId", "active", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_tenantId_name_key" ON "Promotion"("tenantId", "name");

-- CreateIndex
CREATE INDEX "PromotionRule_tenantId_promotionId_idx" ON "PromotionRule"("tenantId", "promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "MultibuyGroup_tenantId_promotionId_key" ON "MultibuyGroup"("tenantId", "promotionId");

-- CreateIndex
CREATE INDEX "Order_tenantId_createdAt_idx" ON "Order"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_tenantId_paymentStatus_fulfilmentStatus_idx" ON "Order"("tenantId", "paymentStatus", "fulfilmentStatus");

-- CreateIndex
CREATE INDEX "Order_tenantId_userId_createdAt_idx" ON "Order"("tenantId", "userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_idempotencyKey_key" ON "Order"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_orderNumber_key" ON "Order"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "OrderItem_tenantId_orderId_idx" ON "OrderItem"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "OrderItem_tenantId_productId_idx" ON "OrderItem"("tenantId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentIntentId_key" ON "Payment"("providerPaymentIntentId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_idx" ON "Payment"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_issuedAt_idx" ON "Invoice"("tenantId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumber_key" ON "Invoice"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE INDEX "Refund_tenantId_orderId_idx" ON "Refund"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "Refund_tenantId_status_idx" ON "Refund"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PickList_orderId_key" ON "PickList"("orderId");

-- CreateIndex
CREATE INDEX "PickList_tenantId_status_idx" ON "PickList"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PickListItem_orderItemId_key" ON "PickListItem"("orderItemId");

-- CreateIndex
CREATE INDEX "PickListItem_tenantId_pickListId_idx" ON "PickListItem"("tenantId", "pickListId");

-- CreateIndex
CREATE INDEX "Substitution_tenantId_orderItemId_status_idx" ON "Substitution"("tenantId", "orderItemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WeightCapture_orderItemId_key" ON "WeightCapture"("orderItemId");

-- CreateIndex
CREATE INDEX "WeightCapture_tenantId_idx" ON "WeightCapture"("tenantId");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_status_receivedAt_idx" ON "WebhookEvent"("tenantId", "status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "OutboxMessage_tenantId_status_availableAt_idx" ON "OutboxMessage"("tenantId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_tenantId_expiresAt_idx" ON "IdempotencyKey"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_tenantId_scope_key_key" ON "IdempotencyKey"("tenantId", "scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseRecord_tenantId_key" ON "LicenseRecord"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseRecord_licenseId_key" ON "LicenseRecord"("licenseId");

-- CreateIndex
CREATE INDEX "FeatureFlagOverride_tenantId_idx" ON "FeatureFlagOverride"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagOverride_tenantId_key_key" ON "FeatureFlagOverride"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AlcoholDayBookEntry_orderItemId_key" ON "AlcoholDayBookEntry"("orderItemId");

-- CreateIndex
CREATE INDEX "AlcoholDayBookEntry_tenantId_dispatchDate_idx" ON "AlcoholDayBookEntry"("tenantId", "dispatchDate");

-- CreateIndex
CREATE INDEX "DriverManifest_tenantId_deliveryDate_idx" ON "DriverManifest"("tenantId", "deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "DriverManifest_tenantId_driverId_deliveryDate_key" ON "DriverManifest"("tenantId", "driverId", "deliveryDate");

-- CreateIndex
CREATE INDEX "PriceCapEvent_tenantId_orderId_idx" ON "PriceCapEvent"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entity_entityId_createdAt_idx" ON "AuditLog"("tenantId", "entity", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_createdAt_idx" ON "AuditLog"("tenantId", "action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PushSubscription_tenantId_userId_idx" ON "PushSubscription"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_tenantId_endpoint_key" ON "PushSubscription"("tenantId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_tenantId_userId_key" ON "NotificationPreference"("tenantId", "userId");


-- Extensions and invariant constraints maintained as SQL because Prisma cannot express them.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX product_name_trgm ON "Product" USING gin ("name" gin_trgm_ops);
CREATE INDEX product_sku_trgm ON "Product" USING gin ("sku" gin_trgm_ops);
CREATE INDEX product_brand_trgm ON "Brand" USING gin ("name" gin_trgm_ops);
CREATE UNIQUE INDEX cart_one_per_user ON "Cart"("tenantId","userId") WHERE "userId" IS NOT NULL AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX cart_one_per_guest ON "Cart"("tenantId","guestToken") WHERE "guestToken" IS NOT NULL AND "status" = 'ACTIVE';

CREATE OR REPLACE FUNCTION deny_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$;
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

-- Request middleware sets app.current_tenant_id before tenant-scoped operations.
ALTER TABLE "TenantSettings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenantsettings ON "TenantSettings" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "BrandingProfile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_brandingprofile ON "BrandingProfile" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "CmsPage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_cmspage ON "CmsPage" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_user ON "User" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Address" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_address ON "Address" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Jurisdiction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_jurisdiction ON "Jurisdiction" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "JurisdictionRuleset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_jurisdictionruleset ON "JurisdictionRuleset" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_category ON "Category" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Brand" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_brand ON "Brand" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_product ON "Product" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "ProductImage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_productimage ON "ProductImage" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Inventory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_inventory ON "Inventory" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_warehouse ON "Warehouse" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Cart" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_cart ON "Cart" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "CartItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_cartitem ON "CartItem" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "AgeVerification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ageverification ON "AgeVerification" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "DeliveryZone" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_deliveryzone ON "DeliveryZone" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "DeliverySlot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_deliveryslot ON "DeliverySlot" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Coupon" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_coupon ON "Coupon" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Promotion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_promotion ON "Promotion" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "PromotionRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_promotionrule ON "PromotionRule" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "MultibuyGroup" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_multibuygroup ON "MultibuyGroup" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_order ON "Order" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_orderitem ON "OrderItem" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_payment ON "Payment" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_invoice ON "Invoice" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Refund" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_refund ON "Refund" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "PickList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_picklist ON "PickList" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "PickListItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_picklistitem ON "PickListItem" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "Substitution" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_substitution ON "Substitution" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "WeightCapture" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_weightcapture ON "WeightCapture" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "OutboxMessage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_outboxmessage ON "OutboxMessage" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "IdempotencyKey" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_idempotencykey ON "IdempotencyKey" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "LicenseRecord" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_licenserecord ON "LicenseRecord" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "FeatureFlagOverride" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_featureflagoverride ON "FeatureFlagOverride" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "AlcoholDayBookEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_alcoholdaybookentry ON "AlcoholDayBookEntry" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "DriverManifest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_drivermanifest ON "DriverManifest" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "PriceCapEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pricecapevent ON "PriceCapEvent" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_auditlog ON "AuditLog" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pushsubscription ON "PushSubscription" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notificationpreference ON "NotificationPreference" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE "Influencer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Influencer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Influencer_tenantId_code_key" ON "Influencer"("tenantId", "code");
CREATE INDEX "Influencer_tenantId_active_idx" ON "Influencer"("tenantId", "active");
ALTER TABLE "Influencer" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_influencer ON "Influencer" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE "AffiliateAttribution" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "revenueMinor" BIGINT NOT NULL,
    "commissionMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateAttribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AffiliateAttribution_orderId_key" ON "AffiliateAttribution"("orderId");
CREATE INDEX "AffiliateAttribution_tenantId_influencerId_createdAt_idx" ON "AffiliateAttribution"("tenantId", "influencerId", "createdAt");
ALTER TABLE "AffiliateAttribution" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_affiliateattribution ON "AffiliateAttribution" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- Tenant foreign keys are generated together so no tenant-scoped table can orphan data.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['TenantSettings','BrandingProfile','CmsPage','User','Address','Jurisdiction','JurisdictionRuleset','Category','Brand','Product','ProductImage','Inventory','Warehouse','Cart','CartItem','AgeVerification','DeliveryZone','DeliverySlot','Coupon','Promotion','PromotionRule','MultibuyGroup','Order','OrderItem','Payment','Invoice','Refund','PickList','PickListItem','Substitution','WeightCapture','OutboxMessage','IdempotencyKey','LicenseRecord','FeatureFlagOverride','AlcoholDayBookEntry','DriverManifest','PriceCapEvent','AuditLog','PushSubscription','NotificationPreference','Influencer','AffiliateAttribution']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE', table_name, table_name || '_tenantId_fkey');
  END LOOP;
END $$;

ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "JurisdictionRuleset" ADD CONSTRAINT "JurisdictionRuleset_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT;
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT;
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;
ALTER TABLE "AgeVerification" ADD CONSTRAINT "AgeVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "DeliverySlot" ADD CONSTRAINT "DeliverySlot_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE RESTRICT;
ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE;
ALTER TABLE "MultibuyGroup" ADD CONSTRAINT "MultibuyGroup_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliverySlotId_fkey" FOREIGN KEY ("deliverySlotId") REFERENCES "DeliverySlot"("id") ON DELETE SET NULL;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT;
ALTER TABLE "PickList" ADD CONSTRAINT "PickList_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT;
ALTER TABLE "PickListItem" ADD CONSTRAINT "PickListItem_pickListId_fkey" FOREIGN KEY ("pickListId") REFERENCES "PickList"("id") ON DELETE CASCADE;
ALTER TABLE "PickListItem" ADD CONSTRAINT "PickListItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT;
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT;
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_substituteProductId_fkey" FOREIGN KEY ("substituteProductId") REFERENCES "Product"("id") ON DELETE RESTRICT;
ALTER TABLE "WeightCapture" ADD CONSTRAINT "WeightCapture_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT;
ALTER TABLE "AlcoholDayBookEntry" ADD CONSTRAINT "AlcoholDayBookEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT;
ALTER TABLE "AlcoholDayBookEntry" ADD CONSTRAINT "AlcoholDayBookEntry_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT;
ALTER TABLE "PriceCapEvent" ADD CONSTRAINT "PriceCapEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "AffiliateAttribution" ADD CONSTRAINT "AffiliateAttribution_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE RESTRICT;
ALTER TABLE "AffiliateAttribution" ADD CONSTRAINT "AffiliateAttribution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT;

CREATE TABLE "Role" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "system" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Role_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Role_tenantId_key_key" ON "Role"("tenantId", "key");
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");
CREATE TABLE "Permission" ("id" UUID NOT NULL, "key" TEXT NOT NULL, "description" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Permission_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE TABLE "RolePermission" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "roleId" UUID NOT NULL, "permissionId" UUID NOT NULL, CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "RolePermission_tenantId_roleId_permissionId_key" ON "RolePermission"("tenantId", "roleId", "permissionId");
CREATE INDEX "RolePermission_tenantId_roleId_idx" ON "RolePermission"("tenantId", "roleId");
CREATE TABLE "UserRoleAssignment" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "userId" UUID NOT NULL, "roleId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "UserRoleAssignment_tenantId_userId_roleId_key" ON "UserRoleAssignment"("tenantId", "userId", "roleId");
CREATE INDEX "UserRoleAssignment_tenantId_userId_idx" ON "UserRoleAssignment"("tenantId", "userId");
CREATE TABLE "RefreshToken" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "userId" UUID NOT NULL, "familyId" UUID NOT NULL, "tokenHash" TEXT NOT NULL, "parentId" UUID, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_tenantId_userId_familyId_idx" ON "RefreshToken"("tenantId", "userId", "familyId");
CREATE INDEX "RefreshToken_tenantId_expiresAt_idx" ON "RefreshToken"("tenantId", "expiresAt");
CREATE TABLE "AuthToken" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "userId" UUID NOT NULL, "kind" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_tenantId_userId_kind_idx" ON "AuthToken"("tenantId", "userId", "kind");
CREATE INDEX "AuthToken_tenantId_expiresAt_idx" ON "AuthToken"("tenantId", "expiresAt");
CREATE TABLE "OtpChallenge" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "phone" TEXT NOT NULL, "codeHash" TEXT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0, "lockedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL, "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id"));
CREATE INDEX "OtpChallenge_tenantId_phone_createdAt_idx" ON "OtpChallenge"("tenantId", "phone", "createdAt" DESC);

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_role ON "Role" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_rolepermission ON "RolePermission" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "UserRoleAssignment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_userroleassignment ON "UserRoleAssignment" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_refreshtoken ON "RefreshToken" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "AuthToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_authtoken ON "AuthToken" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "OtpChallenge" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_otpchallenge ON "OtpChallenge" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RefreshToken"("id") ON DELETE SET NULL;
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;

CREATE TYPE "StorageType" AS ENUM ('AMBIENT', 'CHILLED', 'FROZEN');
CREATE TYPE "InventoryReason" AS ENUM ('PURCHASE', 'SALE', 'RESERVATION', 'RELEASE', 'ADJUSTMENT', 'RETURN', 'WASTAGE', 'PICK_SHORTFALL');
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'VALIDATING', 'READY', 'PROCESSING', 'COMPLETE', 'FAILED');

ALTER TABLE "Category" ADD COLUMN "path" TEXT NOT NULL DEFAULT '/';
ALTER TABLE "Product" ADD COLUMN "dietaryTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "allergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "countryOfOrigin" TEXT NOT NULL DEFAULT 'GB', ADD COLUMN "storageType" "StorageType" NOT NULL DEFAULT 'AMBIENT', ADD COLUMN "shelfLifeDays" INTEGER;
ALTER TABLE "ProductImage" ADD COLUMN "variantId" UUID;
DROP INDEX "ProductImage_tenantId_productId_position_key";
CREATE UNIQUE INDEX "ProductImage_product_position_key" ON "ProductImage"("tenantId", "productId", "position") WHERE "variantId" IS NULL;
CREATE UNIQUE INDEX "ProductImage_variant_position_key" ON "ProductImage"("tenantId", "variantId", "position") WHERE "variantId" IS NOT NULL;
ALTER TABLE "Inventory" ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 5, ADD COLUMN "stockAvailable" INTEGER GENERATED ALWAYS AS (GREATEST("onHand" - "reserved", 0)) STORED;

CREATE TABLE "ProductVariant" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "productId" UUID NOT NULL, "sku" TEXT NOT NULL, "name" TEXT NOT NULL, "priceMinor" BIGINT NOT NULL, "currency" TEXT NOT NULL DEFAULT 'GBP', "attributes" JSONB NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ProductVariant_tenantId_sku_key" ON "ProductVariant"("tenantId", "sku");
CREATE INDEX "ProductVariant_tenantId_productId_active_idx" ON "ProductVariant"("tenantId", "productId", "active");
CREATE TABLE "AttributeSet" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "definitions" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AttributeSet_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AttributeSet_tenantId_key_key" ON "AttributeSet"("tenantId", "key");
CREATE INDEX "AttributeSet_tenantId_idx" ON "AttributeSet"("tenantId");
CREATE TABLE "ProductAttribute" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "productId" UUID NOT NULL, "attributeSetId" UUID NOT NULL, "values" JSONB NOT NULL, CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ProductAttribute_tenantId_productId_attributeSetId_key" ON "ProductAttribute"("tenantId", "productId", "attributeSetId");
CREATE INDEX "ProductAttribute_tenantId_attributeSetId_idx" ON "ProductAttribute"("tenantId", "attributeSetId");
CREATE TABLE "InventoryTransaction" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "inventoryId" UUID NOT NULL, "reason" "InventoryReason" NOT NULL, "quantity" INTEGER NOT NULL, "reference" TEXT, "actorId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id"));
CREATE INDEX "InventoryTransaction_tenantId_inventoryId_createdAt_idx" ON "InventoryTransaction"("tenantId", "inventoryId", "createdAt" DESC);
CREATE INDEX "InventoryTransaction_tenantId_reason_createdAt_idx" ON "InventoryTransaction"("tenantId", "reason", "createdAt" DESC);
CREATE TABLE "ImportJob" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "type" TEXT NOT NULL, "status" "ImportStatus" NOT NULL DEFAULT 'PENDING', "duplicatePolicy" TEXT NOT NULL, "dryRun" BOOLEAN NOT NULL, "sourceFilename" TEXT NOT NULL, "totalRows" INTEGER NOT NULL DEFAULT 0, "validRows" INTEGER NOT NULL DEFAULT 0, "invalidRows" INTEGER NOT NULL DEFAULT 0, "result" JSONB, "createdById" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ImportJob_tenantId_status_createdAt_idx" ON "ImportJob"("tenantId", "status", "createdAt" DESC);
CREATE TABLE "ImportError" ("id" UUID NOT NULL, "tenantId" UUID NOT NULL, "importJobId" UUID NOT NULL, "rowNumber" INTEGER NOT NULL, "field" TEXT, "code" TEXT NOT NULL, "message" TEXT NOT NULL, "input" JSONB NOT NULL, CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ImportError_tenantId_importJobId_rowNumber_idx" ON "ImportError"("tenantId", "importJobId", "rowNumber");

ALTER TABLE "ProductVariant" ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation_productvariant ON "ProductVariant" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "AttributeSet" ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation_attributeset ON "AttributeSet" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "ProductAttribute" ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation_productattribute ON "ProductAttribute" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "InventoryTransaction" ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation_inventorytransaction ON "InventoryTransaction" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "ImportJob" ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation_importjob ON "ImportJob" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "ImportError" ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation_importerror ON "ImportError" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id"), ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
ALTER TABLE "AttributeSet" ADD CONSTRAINT "AttributeSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id");
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id"), ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE, ADD CONSTRAINT "ProductAttribute_attributeSetId_fkey" FOREIGN KEY ("attributeSetId") REFERENCES "AttributeSet"("id") ON DELETE RESTRICT;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE;
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id"), ADD CONSTRAINT "InventoryTransaction_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id"), ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id"), ADD CONSTRAINT "ImportError_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE;
