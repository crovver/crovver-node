# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-01

### Added

- **Core Client**
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
