# crovver-node — Codebase Guide

## This Project

The official Node.js/TypeScript SDK for Crovver. Published to npm as `crovver-node`. Backend teams install this to call the Crovver API from their server — creating tenants, checking feature access, recording usage, initiating checkout, and managing subscriptions.

**Language:** TypeScript · **Package manager:** pnpm · **Outputs:** CJS + ESM + type declarations

### Build & Test
```bash
pnpm build        # tsc to dist/cjs, dist/esm, dist/types
pnpm test         # Jest + ts-jest
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
```

### Structure
```
src/
  index.ts        ← Entire SDK: CrovverClient class + all types (single file)
  constants.ts    ← CROVVER_BASE_URL and other constants
tests/
  client.test.ts  ← Unit tests for CrovverClient
dist/
  cjs/            ← CommonJS output (require)
  esm/            ← ES module output (import)
  types/          ← TypeScript declarations
```

### Key Design Decisions
- **Single file SDK** — `src/index.ts` contains the client class and all type definitions
- **Auto-retry with exponential backoff + jitter** — applied to all read operations
- **No retry on checkout** — `createCheckoutSession()` and `createProrationCheckout()` are deliberately not retried to prevent duplicate charges
- **Envelope unwrapping** — the Axios interceptor transparently unwraps `{ success, data, error }` so callers get the data directly
- **Secret key only** — uses `sk_live_` / `sk_test_` keys; never use in browser

### Available Methods on `CrovverClient`
| Method | What it does |
|--------|-------------|
| `createTenant()` | Create a B2B workspace/tenant |
| `getTenant()` | Fetch tenant info by external ID |
| `getPlans()` | List all plans for the org |
| `getSubscriptions()` | Get active subscriptions for a tenant |
| `createCheckoutSession()` | Create a Stripe checkout session (no retry) |
| `canAccess()` | Check if a tenant can access a feature |
| `recordUsage()` | Record metered usage for a metric |
| `checkUsageLimit()` | Check current usage vs limit |
| `createProrationCheckout()` | Mid-cycle seat upgrade checkout (no retry) |
| `cancelSubscription()` | Cancel a subscription at period end |
| `getInvoices()` | Fetch invoices for a tenant |
| `getSupportedProviders()` | List available payment providers |

### Usage Example
```typescript
import CrovverClient from 'crovver-node';

const crovver = new CrovverClient({ apiKey: 'sk_live_...' });

const canAccess = await crovver.canAccess('tenant-123', 'advanced-analytics');
```

---

## Crovver Ecosystem

Crovver is a **subscription management layer** for SaaS products. It sits between a SaaS app and payment providers (Stripe, Khalti, eSewa), handling subscription state, feature entitlements, seat tracking, usage limits, and hosted checkout — so SaaS teams don't build billing themselves. Payment credentials are never stored in the database; they go through Infisical or Vault.

### Sub-Projects
| Folder | What it is | Port / Registry |
|--------|-----------|-----------------|
| `crovver-mvp` | API server + admin dashboard (Next.js 16) | 3000 |
| `crovver-portal` | Customer-facing billing portal (Next.js 15) | 3002 |
| `crovver-node` | Official Node.js/TypeScript SDK — **this project** | npm: `crovver-node` |
| `crovver-react` | Official React SDK | npm: `crovver-react` |
| `crovver-php` | Official PHP 8.2+ SDK | Packagist: `crovver/crovver-php` |
| `docs` | Mintlify documentation site | — |

### Core Data Model
| Entity | Description |
|--------|-------------|
| **Org** | A SaaS company using Crovver. Type `b2b` = workspace-based customers; `d2c` = individual users |
| **Tenant** | The billing unit — a workspace (B2B) or user (D2C). Identified via `external_tenant_id` |
| **Plan** | Pricing tier with `features` (boolean flags) and `limits` (numeric caps). Flat or seat-based |
| **Subscription** | Tenant ↔ Plan binding. Statuses: pending → trialing → active → past_due → canceled |
| **Entitlement** | `canAccess(tenantId, featureKey)` — checks plan features; trial counts as active |

### API Key Types
- `pk_live_` / `pk_test_` — public keys, safe for browser (React SDK)
- `sk_live_` / `sk_test_` — secret keys, backend only — **this SDK uses these**

### Checkout Flow
1. SaaS frontend calls `redirectToCheckout()` on the React SDK
2. React SDK calls `POST /api/public/auth/checkout-token` on crovver-mvp → gets a short-lived JWT
3. Browser redirects to crovver-portal
4. Portal calls `POST /api/public/checkout` → Stripe session created
5. Stripe webhook fires → crovver-mvp activates subscription

### Three API Surfaces on crovver-mvp
| Surface | Base path | Auth method |
|---------|-----------|-------------|
| Public SDK | `/api/public/*` | Bearer `sk_live_` key — **this SDK calls here** |
| Admin dashboard | `/api/admin/*` | Session cookie |
| Webhooks | `/api/webhooks/*` | HMAC signature |
