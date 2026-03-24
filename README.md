# crovver-node

[![npm version](https://img.shields.io/npm/v/crovver-node.svg)](https://www.npmjs.com/package/crovver-node)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Node.js/TypeScript SDK for integrating [Crovver](https://crovver.com) subscription management into your backend.

## Features

- **Complete API Coverage** — tenants, plans, subscriptions, checkout, entitlements, invoices, proration
- **TypeScript Support** — full type definitions included
- **B2B & D2C Support** — works with both organization types
- **Error Handling** — `CrovverError` class with status codes and retryability flags
- **Automatic Retries** — exponential backoff with jitter for transient failures
- **No Checkout Retry** — payment-creating endpoints are never retried to prevent duplicate charges
- **ESM & CommonJS** — dual module support

## Installation

```bash
npm install crovver-node
# or
yarn add crovver-node
# or
pnpm add crovver-node
```

## Quick Start

```typescript
import { CrovverClient } from "crovver-node";

const crovver = new CrovverClient({
  apiKey: "sk_live_your_api_key",
});

const canAccess = await crovver.canAccess("company-123", "advanced-analytics");
if (canAccess) {
  console.log("Access granted!");
}
```

## Configuration

```typescript
interface CrovverConfig {
  apiKey: string;       // Bearer API key — starts with sk_live_ or sk_test_
  timeout?: number;     // ms, default 30 000
  maxRetries?: number;  // default 3
  debug?: boolean;      // default false
  logger?: (message: string, data?: unknown) => void;
}
```

## Error Handling

```typescript
import { CrovverClient, CrovverError } from "crovver-node";

try {
  await crovver.canAccess("company-123", "premium-feature");
} catch (error) {
  if (error instanceof CrovverError) {
    console.error(error.message);
    console.error("HTTP status:", error.statusCode);
    console.error("Retryable:", error.isRetryable);
  }
}
```

Automatic retries apply to 5xx, 429, 408, and network errors. 4xx errors are **not** retried.

---

## API Reference

### Tenant Management (B2B Only)

#### `createTenant`

```typescript
const result = await crovver.createTenant({
  externalTenantId: "company-123",
  name: "Acme Corporation",
  ownerExternalUserId: "user-456",
  ownerEmail: "admin@acme.com",
  ownerName: "John Doe",
});
console.log("Tenant ID:", result.tenant.id);
```

#### `getTenant`

```typescript
const { tenant, members } = await crovver.getTenant("company-123");
```

---

### Plans

#### `getPlans`

```typescript
const { plans } = await crovver.getPlans();
plans.forEach((plan) => {
  console.log(`${plan.name}: ${plan.pricing.currency} ${plan.pricing.amount}/${plan.pricing.interval}`);
});
```

---

### Subscriptions

#### `getSubscriptions`

```typescript
const { subscriptions } = await crovver.getSubscriptions("company-123");
subscriptions.forEach((sub) => {
  console.log(`${sub.plan.name} — ${sub.status}`);
});
```

#### `cancelSubscription`

Cancels at period end (no immediate termination).

```typescript
const result = await crovver.cancelSubscription(
  "sub-uuid",
  "too_expensive",
  "Pricing is a bit high for our team size"
);
console.log(`Ends at: ${result.willEndAt}`);
```

---

### Checkout

#### `createCheckoutSession`

**B2B:**

```typescript
const checkout = await crovver.createCheckoutSession({
  requestingUserId: "user-456",
  requestingTenantId: "company-123",
  planId: "plan-uuid",
  provider: "stripe",
  successUrl: "https://myapp.com/success",
  cancelUrl: "https://myapp.com/cancel",
});
window.location.href = checkout.checkoutUrl;
```

**D2C (tenant auto-created):**

```typescript
const checkout = await crovver.createCheckoutSession({
  requestingUserId: "user-789",
  userEmail: "john@example.com",
  userName: "John Doe",
  planId: "plan-uuid",
  provider: "stripe",
  successUrl: "https://myapp.com/success",
  cancelUrl: "https://myapp.com/cancel",
});
```

---

### Entitlements

#### `canAccess`

```typescript
const canAccess = await crovver.canAccess("company-123", "advanced-analytics");
```

#### `recordUsage`

```typescript
await crovver.recordUsage("company-123", "api-calls", 1, {
  endpoint: "/api/v1/users",
});
```

#### `checkUsageLimit`

```typescript
const usage = await crovver.checkUsageLimit("company-123", "api-calls");
console.log(`${usage.current} / ${usage.limit} — allowed: ${usage.allowed}`);
```

---

### Proration (Seat-Based Plans)

#### `createProrationCheckout`

Creates a one-time payment session for a mid-cycle seat capacity upgrade.
The proration amount is calculated server-side.

```typescript
const checkout = await crovver.createProrationCheckout({
  requestingEntityId: "company-123",
  newCapacity: 15,
  planId: "plan-uuid",           // optional
  successUrl: "https://myapp.com/success",
  cancelUrl: "https://myapp.com/cancel",
});

if (checkout.checkoutUrl) {
  window.location.href = checkout.checkoutUrl;
}
console.log(`Prorated amount: ${checkout.prorationAmount} ${checkout.prorationDetails.currency}`);
```

---

### Billing

#### `getInvoices`

```typescript
const { invoices } = await crovver.getInvoices("company-123");
invoices.forEach((inv) => {
  console.log(`${inv.invoice_number}: ${inv.total_amount} ${inv.currency} — ${inv.status}`);
});
```

---

### Payment Providers

#### `getSupportedProviders`

```typescript
const { providers } = await crovver.getSupportedProviders();
providers.forEach((p) => console.log(`${p.name}: ${p.code}`));
```

---

## TypeScript Exports

```typescript
import {
  CrovverClient,
  CrovverError,
  CrovverConfig,
  Plan,
  Subscription,
  Tenant,
  CreateTenantRequest,
  CreateCheckoutSessionRequest,
  CreateProrationCheckoutRequest,
  CreateProrationCheckoutResponse,
  CancelSubscriptionResponse,
  GetInvoicesResponse,
  CheckUsageLimitResponse,
} from "crovver-node";
```

---

## License

MIT
