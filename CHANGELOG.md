# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - Unreleased

The SDK for the revamped Crovver server. Release only after that server release: an older server
rejects a D2C `createTenant`, sends no `product.type` and no `seatTiers`.

### Removed (breaking)

- `recordUsage()`, `RecordUsageRequest` and `RecordUsageResponse`. The server's usage-events route is deprecated and nothing reads what it writes; consume credit pools with `consumeCredits()` and read them with `getCreditsBalance()`.
- `Plan.payment_providers` (use `paymentProviders`) and `Plan.created_at` / `Plan.updated_at` (use `createdAt` / `updatedAt`). The plans endpoint never sent the snake-case fields.
- `organization.type` on `GetPlansResponse`, `GetTenantResponse` and `GetSubscriptionsResponse`. The customer type belongs to the product: read `plans[].product.type`.

### Changed

- `CreateTenantRequest.externalTenantId` is optional: omit it to create an individual (D2C) customer keyed on `externalUserId`.
- `Product.type` (`"b2b" | "d2c"`) added to plans' `product`.
- `GetPlansResponse.organization.type` is deprecated — read `plans[].product.type`.
- `GetTenantResponse.organization.type` and `GetSubscriptionsResponse.organization.type` are optional and deprecated: the
  server no longer sends them. Type-level change for strict-null consumers that read them.

### Added

- `capacity.remove({ requestingEntityId, externalUserId })`: take a user's seat away at once. The seat stays on the subscription, vacant, for the next allocation; capacity and price are unchanged until renewal. Returns `RemoveSeatResponse` (`alreadyRemoved` on a retry). Needs the server's `POST /api/public/capacity/remove`.
- Tiered seat plans: `Plan.seatTiers` and, on subscription responses, `PlanPricing.seatTiers` (`PlanSeatTier`: `currency`, `minQuantity`, `maxQuantity`, `price`). A band's price is the whole period's price for any seat count in its range; a tiered plan's `basePrice` and `perSeatPrice` are 0.
- `planPeriodCharge(plan, seats, currency?)` and `seatTierFor(tiers, currency, seats)`: price a plan at a seat count by the rules Crovver charges, tiered or not.

### Changed

- `CreateProrationCheckoutResponse.prorationId` is `string | null`, and the response carries `invoiceId`. On a tiered plan, a seat increase that stays in the current band is applied at once with `requiresPayment: false` and no proration record.

## [1.0.0] - 2026-03-29

### Added

- **Core Client**
  - `baseUrl` config option to override the API base URL (useful for local development and testing)
  - `CrovverClient` class with full TypeScript support
  - Automatic retry with exponential backoff for transient failures (5xx, 429, timeouts)
  - Debug logging support with custom logger option

- **Tenant Management** (B2B)
  - `createTenant()` - Create a new tenant/workspace
  - `getTenant()` - Get tenant information by external ID

- **Plans**
  - `getPlans()` - Fetch all available subscription plans

- **Subscriptions**
  - `getSubscriptions()` - Get active subscriptions for a tenant/user

- **Checkout**
  - `createCheckoutSession()` - Create payment checkout session
  - Support for B2B and D2C checkout flows
  - Support for Stripe, Paddle, and LemonSqueezy providers

- **Entitlements**
  - `canAccess()` - Check feature access for tenant/user
  - `recordUsage()` - Record metered usage
  - `checkUsageLimit()` - Check usage against limits

- **Seat-Based Billing**
  - `getActiveCapacity()` - Get current seat utilization
  - `recordSeatAllocation()` - Record seat assignment with proration calculation
  - `removeSeat()` - Remove seat allocation
  - `createProrationCheckout()` - Create payment session for seat upgrades

- **Payment Providers**
  - `getSupportedProviders()` - List available payment providers

- **Error Handling**
  - `CrovverError` class with status codes and error codes
  - Automatic classification of retryable vs non-retryable errors

- **TypeScript**
  - Full type definitions for all requests and responses
  - Strict TypeScript configuration
  - ESM and CommonJS dual build support

### Security

- API key passed via Authorization header (not in URL)
- No credentials logged in debug mode

## [0.1.0] - 2026-01-15

### Added

- Initial beta release
- Basic client implementation
- Core API methods

---

## Migration Guide

### From 0.x to 1.0.0

1. **Import Changes**

   ```typescript
   // Old
   import CrovverClient from "@crovver/sdk";

   // New (recommended)
   import { CrovverClient } from "@crovver/sdk";
   ```

2. **Configuration**

   ```typescript
   // New options available
   const client = new CrovverClient({
     apiKey: "your-key",
     maxRetries: 3, // New: Configure retries (default: 3)
     debug: true, // New: Enable debug logging
   });
   ```

3. **New Methods**
   - `recordSeatAllocation()` - Use for seat-based billing
   - `removeSeat()` - Use for seat removal
   - `getSupportedProviders()` - List payment providers

4. **Error Handling**
   ```typescript
   // CrovverError now includes more context
   catch (error) {
     if (error instanceof CrovverError) {
       console.log(error.isRetryable); // New: Check if error is retryable
       console.log(error.statusCode);
       console.log(error.code);
     }
   }
   ```
