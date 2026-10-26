import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { CROVVER_BASE_URL } from "./constants";

// ════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ════════════════════════════════════════════════════════════════════════

/**
 * Configuration options for the Crovver client
 */
export interface CrovverConfig {
  /** Your organization's API key (required) */
  apiKey: string;
  /** Override the base URL (optional, useful for local development) */
  baseUrl?: string;
  /** Request timeout in milliseconds (optional, defaults to 30000) */
  timeout?: number;
  /** Maximum number of retries for failed requests (optional, defaults to 3) */
  maxRetries?: number;
  /** Enable debug logging (optional, defaults to false) */
  debug?: boolean;
  /** Custom logger function (optional) */
  logger?: (message: string, data?: unknown) => void;
}

/**
 * API Response wrapper type (internal)
 * Matches the backend ApiResponseHelper format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: {
    message: string;
    code?: string;
  } | null;
  meta?: Record<string, unknown>;
}

/**
 * Custom error class for Crovver API errors
 */
export class CrovverError extends Error {
  /** HTTP status code (if available) */
  public readonly statusCode?: number;
  /** Error code from API (if available) */
  public readonly code?: string;
  /** Original error object (if available) */
  public readonly originalError?: unknown;
  /** Whether the error is retryable (5xx, network errors, rate limits) */
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    statusCode?: number,
    code?: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = "CrovverError";
    this.statusCode = statusCode;
    this.code = code;
    this.originalError = originalError;
    this.isRetryable = CrovverError.isRetryableStatus(statusCode);

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CrovverError);
    }
  }

  /**
   * Check if a status code indicates a retryable error
   * - 5xx: Server errors (temporary)
   * - 429: Rate limited
   * - 408: Request timeout
   * - undefined: Network errors
   */
  static isRetryableStatus(status?: number): boolean {
    if (!status) return true; // Network errors are retryable
    return status >= 500 || status === 429 || status === 408;
  }

  /**
   * Convert to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      isRetryable: this.isRetryable,
    };
  }
}

// ────────────────────────────────────────────────────────────────────────
// Tenant Types
// ────────────────────────────────────────────────────────────────────────

export interface CreateTenantRequest {
  /**
   * Your SaaS app's company/workspace ID (B2B). Omit it for an individual customer (D2C):
   * the tenant is then keyed on `externalUserId`, the same tenant a D2C checkout creates.
   */
  externalTenantId?: string;
  /** Company/workspace name */
  name: string;
  /** URL-friendly slug (optional, auto-generated from name if not provided) */
  slug?: string;
  /** Owner's user ID from your app */
  externalUserId: string;
  /** Owner's email (optional). Also becomes the customer's email in the dashboard when it has none. */
  ownerEmail?: string;
  /** Owner's name (optional) */
  ownerName?: string;
  /** Custom metadata (optional) */
  metadata?: Record<string, unknown>;
}

export interface TenantOwner {
  id: string;
  externalUserId: string;
  email?: string;
  name?: string;
}

export interface Tenant {
  id: string;
  externalTenantId: string;
  name: string;
  slug: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateTenantResponse {
  tenant: Tenant;
  owner: TenantOwner;
  message: string;
}

export interface GetTenantResponse {
  tenant: Tenant;
  members: TenantOwner[];
  organization: {
    id: string;
    name: string;
  };
}

// ────────────────────────────────────────────────────────────────────────
// Plans Types
// ────────────────────────────────────────────────────────────────────────

export interface PlanPricing {
  currency: string;
  interval: "monthly" | "yearly" | "one_time";
  isSeatBased: boolean;
  /** Flat-rate pricing amount */
  amount?: number | null;
  /** Base price for seat-based plans */
  basePrice?: number | null;
  /** Number of seats included in base price */
  includedSeats?: number;
  /** Price per additional seat */
  perSeatPrice?: number | null;
  /** Minimum number of seats */
  minSeats?: number | null;
  /** Maximum number of seats */
  maxSeats?: number | null;
  /**
   * Subscription responses only: the plan's seat bands in the subscription's currency.
   * Empty for a plan that is not tiered. See {@link PlanSeatTier}.
   */
  seatTiers?: PlanSeatTier[];
}

/**
 * One seat band of a tiered plan. The band's `price` is the whole billing period's price for any
 * seat count in `[minQuantity, maxQuantity]` — a flat price for the range, not a per-seat rate.
 * A tiered plan's `basePrice` and `perSeatPrice` are 0; use {@link planPeriodCharge} to price it.
 */
export interface PlanSeatTier {
  currency: string;
  minQuantity: number;
  /** `null` for the open top band */
  maxQuantity: number | null;
  /** Two-decimal string, e.g. "250.00" */
  price: string;
}

export interface PlanTrial {
  days: number;
  available: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  /** Who the product sells to: workspaces (`b2b`) or individuals (`d2c`). Decides how checkout keys the tenant. */
  type?: "b2b" | "d2c";
}

export interface PaymentProviderMapping {
  provider_id: string;
  provider_type: string;
  provider_name?: string;
  /** External price ID for flat-rate plans */
  external_price_id?: string;
  /** External product ID for seat-based plans */
  external_product_id?: string;
  /** Base price ID for seat-based plans */
  external_base_price_id?: string;
  /** Per-seat price ID for seat-based plans */
  external_per_seat_price_id?: string;
  is_active: boolean;
}

/** Per-currency price entry from the plan_prices table */
export interface PlanPrice {
  currency: string;
  amount: number | null;
  basePrice: number | null;
  perSeatPrice: number | null;
}

export interface CreditPool {
  pool_key: string;
  display_name: string;
  limit_per_period: number;
  refill_behavior: "reset" | "rollover";
  limit_behavior: "hard" | "soft";
  rollover_cap: number | null;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  /** First/default price (backwards compatibility) */
  pricing: PlanPricing;
  /** All configured prices, one per currency */
  prices: PlanPrice[];
  /**
   * Seat bands for every currency, ordered by currency then `minQuantity`. Empty unless the plan is
   * tiered; absent from crovver-mvp versions that predate tiered plans.
   */
  seatTiers?: PlanSeatTier[];
  trial: PlanTrial;
  test_mode: boolean;
  isFree: boolean;
  isSeatBased: boolean;
  features: Record<string, boolean>;
  creditPools: CreditPool[];
  product: Product;
  paymentProviders: PaymentProviderMapping[];
  createdAt: string;
  updatedAt: string;
}

export interface GetPlansResponse {
  plans: Plan[];
  organization: {
    id: string;
    name: string;
  };
}

export interface AvailableAddon {
  id: string;
  pool_key: string;
  display_name: string;
  description: string | null;
  credit_qty: number;
  min_qty: number | null;
  max_qty: number | null;
  expiry_type: "period" | "days" | "never";
  expiry_days: number | null;
  currency: string;
  amount: number;
  provider_id: string;
  external_price_id: string | null;
  current_balance: number;
  base_remaining: number;
  addon_remaining: number;
  pool_limit: number | null;
}

export interface AddonPurchaseRequest {
  addonId: string;
  currency: string;
  idempotencyKey: string;
  /** Number of units to purchase. Defaults to 1. Must respect min_qty / max_qty from AvailableAddon. */
  qty?: number;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AddonPurchaseResponse {
  purchaseId: string;
  checkoutUrl: string | null;
  requiresPayment: boolean;
  addonName: string;
  qty: number;
  unitPrice: number;
  creditQty: number;
  amount: number;
  currency: string;
  alreadyProcessed?: boolean;
}

export interface ActiveAddonPool {
  pool_key: string;
  addon_remaining: string;
  active_addon_grants: string;
  next_addon_expiry: string | null;
}

// ────────────────────────────────────────────────────────────────────────
// Subscriptions Types
// ────────────────────────────────────────────────────────────────────────

export interface SubscriptionBilling {
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string | null;
}

export interface SubscriptionTrial {
  is_active: boolean;
  ends_at: string | null;
  days_remaining: number;
}

export interface SubscriptionCancellation {
  is_canceled: boolean;
  canceled_at: string | null;
  will_end_at: string | null;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  pricing: PlanPricing;
  features: Record<string, boolean>;
  creditPools: CreditPool[];
  productId?: string;
  productName?: string;
  productSlug?: string;
}

export type SubscriptionStatus =
  | "active"
  | "trial"
  | "past_due"
  | "pending_cancel"
  | "canceled"
  | "expired";

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  provider_subscription_id: string;
  billing: SubscriptionBilling;
  trial: SubscriptionTrial;
  cancellation: SubscriptionCancellation;
  plan: SubscriptionPlan;
  product: Product;
  payment_providers: PaymentProviderMapping[];
  capacity?: {
    units: number;
    billing_mode: string;
  };
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GetSubscriptionsResponse {
  subscriptions: Subscription[];
  tenant: {
    id: string;
    external_tenant_id: string;
    name: string;
    slug: string;
    metadata: Record<string, unknown>;
  };
  organization: {
    id: string;
    name: string;
  };
}

// ────────────────────────────────────────────────────────────────────────
// Checkout Types
// ────────────────────────────────────────────────────────────────────────

/**
 * Payment providers supported by the Crovver API.
 *
 * - `stripe` — recurring billing, all currencies configured on the plan.
 * - `khalti` / `esewa` / `connectips` — Nepal, NPR only, non-recurring:
 *   one payment covers one billing interval (renewal = re-checkout), and
 *   plans with trial days are rejected for these providers.
 *
 * Note: previous versions listed "paddle" and "lemonsqueezy" here; the API
 * never accepted them (they always returned 400), so they were removed.
 */
export type PaymentProvider = "stripe" | "khalti" | "esewa" | "connectips";

export interface CreateCheckoutSessionRequest {
  /** User making the purchase */
  externalUserId: string;
  /** Tenant ID (required for B2B, optional for D2C) */
  externalTenantId?: string;
  /** Plan to subscribe to */
  planId: string;
  /** Payment provider to use */
  provider: PaymentProvider;
  /** URL to redirect to on successful payment */
  successUrl?: string;
  /** URL to redirect to on canceled payment */
  cancelUrl?: string;
  /** User email (required for D2C tenant creation) */
  userEmail?: string;
  /** User name (required for D2C tenant creation) */
  userName?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Currency code (ISO 4217, e.g. "USD", "NPR"). Defaults to plan's primary currency. */
  currency?: string;
  /** Number of seats to purchase (for seat-based plans) */
  totalCapacityUnits?: number;
}

export interface CreateCheckoutSessionResponse {
  subscriptionId: string;
  checkoutUrl: string;
  sessionId: string;
  error: string | null;
}

// ────────────────────────────────────────────────────────────────────────
// Entitlement Types
// ────────────────────────────────────────────────────────────────────────

export interface CanAccessRequest {
  /** External tenant ID (B2B) or user ID (D2C) */
  requestingEntityId: string;
  /** Feature key to check access for */
  featureKey: string;
}

export interface CanAccessResponse {
  canAccess: boolean;
}

export interface CheckUsageLimitRequest {
  /** External tenant ID (B2B) or user ID (D2C) */
  requestingEntityId: string;
  /** Metric key to check */
  metric: string;
}

export interface CheckUsageLimitResponse {
  /** Whether additional usage is allowed */
  allowed: boolean;
  /** Current usage value */
  current: number;
  /** Usage limit (null = unlimited) */
  limit: number | null;
  /** Remaining usage (null = unlimited) */
  remaining: number | null;
  /** Usage percentage (null = unlimited) */
  percentage: number | null;
}

// ────────────────────────────────────────────────────────────────────────
// Bulk Seat Allocation Types
// ────────────────────────────────────────────────────────────────────────

export interface BulkAllocateSeatUser {
  /** Your SaaS app's user ID */
  externalUserId: string;
  /** User's email address (optional) */
  email?: string;
  /** User's display name (optional) */
  name?: string;
}

export interface BulkAllocateSeatsRequest {
  /** External tenant ID */
  requestingEntityId: string;
  /** List of users to allocate — max 100 per request */
  users: BulkAllocateSeatUser[];
  /** Metadata attached to every allocation (optional) */
  metadata?: Record<string, unknown>;
}

export interface BulkAllocateSeatsCapacity {
  activeCount: number;
  capacityUnits: number;
}

export interface BulkAllocateSeatsResponse {
  /** User IDs inserted this call */
  allocated: string[];
  /** Already active — not re-inserted (idempotent) */
  skipped: string[];
  /** Would exceed capacity_units — not inserted */
  rejected: string[];
  capacity: BulkAllocateSeatsCapacity;
  /** Set when some users were rejected due to capacity limit */
  message?: string;
}

export interface GetAllocationsRequest {
  /** External tenant ID */
  requestingEntityId: string;
  /** Filter by allocation status (default: active) */
  status?: 'active' | 'removed' | 'all';
  /** 1-based page number (default: 1) */
  page?: number;
  /** Page size, max 100 (default: 50) */
  limit?: number;
}

export interface AllocationUser {
  externalUserId: string;
  email:          string | null;
  name:           string | null;
  status:         'active' | 'removed';
  allocatedAt:    string;
  removedAt:      string | null;
  metadata:       Record<string, unknown>;
}

export interface AllocationCapacity {
  activeCount:           number;
  capacityUnits:         number;
  utilizationPercentage: number;
  exceeded:              boolean;
}

export interface AllocationPagination {
  total:           number;
  page:            number;
  limit:           number;
  totalPages:      number;
  hasNextPage:     boolean;
  hasPreviousPage: boolean;
}

export interface GetAllocationsResponse {
  allocations: AllocationUser[];
  capacity:    AllocationCapacity;
  pagination:  AllocationPagination;
}

export interface RemoveSeatRequest {
  /** External tenant/workspace ID */
  requestingEntityId: string;
  /** The user whose seat is taken away */
  externalUserId: string;
}

export interface RemoveSeatResponse {
  externalUserId: string;
  /** True when the user had already been removed: a retry, nothing changed */
  alreadyRemoved: boolean;
  removedAt: string;
  /** The seat stays on the subscription, vacant: `capacityUnits` is unchanged */
  capacity: {
    activeCount: number;
    capacityUnits: number;
    vacantSeats: number;
  };
}

// ────────────────────────────────────────────────────────────────────────
// Credit Types
// ────────────────────────────────────────────────────────────────────────

export interface ConsumeInput {
  /** External tenant ID from your SaaS app */
  tenantId: string;
  /** Pool key, e.g. 'job_posts', 'api_calls' */
  poolKey: string;
  /** Number of credits to consume — must be a positive integer */
  amount: number;
  /** Stable per-event key — never use random values */
  idempotencyKey: string;
  /** Scope consumption to a specific subscription. Defaults to the most recent active one. */
  subscriptionId?: string;
  /** Scope consumption to the product's active subscription (a tenant has at most one per product). */
  productSlug?: string;
  metadata?: Record<string, unknown>;
}

export interface ConsumeResponse {
  result: "allowed" | "blocked" | "warning";
  remaining: number;
  alreadyProcessed: boolean;
  poolKey: string;
}

export interface PoolBalance {
  poolKey: string;
  displayName: string;
  baseRemaining: number;
  addonRemaining: number;
  total: number;
  limit: number;
  limitBehavior: "hard" | "soft";
  nextExpiry: string | null;
  usagePercent: number;
}

export type BalanceResponse = Record<string, PoolBalance>;

// ────────────────────────────────────────────────────────────────────────
// Proration Types
// ────────────────────────────────────────────────────────────────────────

export interface CreateProrationCheckoutRequest {
  /** External tenant ID */
  externalTenantId: string;
  /** New total seat capacity to upgrade to */
  newCapacity: number;
  /** Plan ID (optional if the tenant only has one active subscription) */
  planId?: string;
  /** URL to redirect to on success */
  successUrl?: string;
  /** URL to redirect to on cancel */
  cancelUrl?: string;
}

export interface CreateProrationCheckoutResponse {
  /**
   * `null` when nothing is due: on a tiered plan, a seat count that stays in the current band (or a
   * step with nothing left to prorate) is applied at once, with `requiresPayment: false`.
   */
  prorationId: string | null;
  checkoutUrl: string | null;
  /** The pending invoice a redirect-gateway (Khalti / eSewa / ConnectIPS) proration settles. */
  invoiceId?: string | null;
  requiresPayment: boolean;
  prorationAmount: number;
  prorationDetails: Record<string, unknown>;
  message: string;
}

// ────────────────────────────────────────────────────────────────────────
// Subscription Cancellation Types
// ────────────────────────────────────────────────────────────────────────

export interface CancelSubscriptionResponse {
  subscriptionId: string;
  status: string;
  canceledAt: string | null;
  currentPeriodEnd: string | null;
}

// ────────────────────────────────────────────────────────────────────────
// Invoice Types
// ────────────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  status: string;
  totalAmount: string;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  issuedAt: string;
  periodStart: string;
  periodEnd: string;
  paymentProvider: string;
  planName: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

export interface GetInvoicesResponse {
  invoices: Invoice[];
}

// ────────────────────────────────────────────────────────────────────────
// Subscription Status Types
// ────────────────────────────────────────────────────────────────────────

export interface SubscriptionStatusResponse {
  isActive: boolean;
  status: SubscriptionStatus | null;
  plan: SubscriptionPlan | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

// ────────────────────────────────────────────────────────────────────────
// Payment Provider Types
// ────────────────────────────────────────────────────────────────────────

export interface SupportedPaymentProvider {
  id: string;
  code: string;
  name: string;
  description?: string;
  logoUrl?: string;
  isEnabled: boolean;
  supportsRecurringBilling: boolean;
  supportsWebhooks: boolean;
  supportsTestMode: boolean;
  capabilities: string[];
}

export interface GetSupportedProvidersResponse {
  providers: SupportedPaymentProvider[];
}

// ════════════════════════════════════════════════════════════════════════
// RETRY UTILITY
// ════════════════════════════════════════════════════════════════════════

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoff(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

// ════════════════════════════════════════════════════════════════════════
// CROVVER CLIENT
// ════════════════════════════════════════════════════════════════════════

/** The band holding `seats` in one currency's ladder, or `null`. */
export function seatTierFor(
  tiers: readonly PlanSeatTier[],
  currency: string,
  seats: number
): PlanSeatTier | null {
  const cur = currency.toUpperCase();
  return (
    tiers
      .filter((t) => t.currency.toUpperCase() === cur)
      .sort((a, b) => a.minQuantity - b.minQuantity)
      .find((t) => t.minQuantity <= seats && (t.maxQuantity == null || seats <= t.maxQuantity)) ?? null
  );
}

/**
 * One billing period's price for a plan at a seat count, by the same rules Crovver charges:
 * free is 0; a tiered plan is the price of the band holding `seats` (`null` when no band does — that
 * count cannot be purchased); another seat-based plan is `basePrice + max(0, seats − includedSeats) ×
 * perSeatPrice`; a flat plan is its amount. `null` too when the plan has no price in `currency`.
 * Country-localized prices are not on the plans list, so a localized customer may be charged otherwise.
 */
export function planPeriodCharge(
  plan: Pick<Plan, "isFree" | "isSeatBased" | "pricing" | "prices" | "seatTiers">,
  seats: number,
  currency: string = plan.pricing.currency
): number | null {
  if (plan.isFree) return 0;
  const cur = currency.toUpperCase();
  const ladder = (plan.seatTiers ?? []).filter((t) => t.currency.toUpperCase() === cur);
  if (plan.isSeatBased && ladder.length > 0) {
    const band = seatTierFor(ladder, cur, seats);
    return band ? Number(band.price) : null;
  }
  const price = plan.prices.find((p) => p.currency.toUpperCase() === cur);
  if (!price) return null;
  if (!plan.isSeatBased) return price.amount == null ? null : Number(price.amount);
  return (
    Number(price.basePrice ?? 0) +
    Math.max(seats - (plan.pricing.includedSeats ?? 0), 0) * Number(price.perSeatPrice ?? 0)
  );
}

export class CrovverClient {
  private client: AxiosInstance;
  private config: Required<Pick<CrovverConfig, "maxRetries" | "debug">> &
    CrovverConfig;
  private logger: (message: string, data?: unknown) => void;

  constructor(config: CrovverConfig) {
    if (!config.apiKey) {
      throw new Error("CrovverConfig.apiKey is required");
    }

    this.config = {
      ...config,
      maxRetries: config.maxRetries ?? 3,
      debug: config.debug ?? false,
    };

    this.logger =
      config.logger ||
      ((message: string, data?: unknown) => {
        if (this.config.debug) {
          console.log(`[Crovver SDK] ${message}`, data ?? "");
        }
      });

    this.client = axios.create({
      baseURL: config.baseUrl ?? CROVVER_BASE_URL,
      timeout: config.timeout || 30000,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        this.logger(`Request: ${config.method?.toUpperCase()} ${config.url}`, {
          data: config.data,
          params: config.params,
        });
        return config;
      }
    );

    // Response interceptor to unwrap ApiResponse format
    this.client.interceptors.response.use(
      (response) => {
        const apiResponse = response.data as ApiResponse;

        this.logger(`Response: ${response.status}`, {
          success: apiResponse.success,
          hasData: !!apiResponse.data,
        });

        if (apiResponse.success && apiResponse.data !== null) {
          response.data = apiResponse.data;
          return response;
        } else if (!apiResponse.success && apiResponse.error) {
          throw new CrovverError(
            apiResponse.error.message,
            response.status,
            apiResponse.error.code
          );
        }

        return response;
      },
      (error: AxiosError) => {
        if (error.response) {
          const apiResponse = error.response.data as ApiResponse;

          this.logger(`Error Response: ${error.response.status}`, {
            error: apiResponse?.error,
          });

          if (apiResponse?.error) {
            throw new CrovverError(
              apiResponse.error.message,
              error.response.status,
              apiResponse.error.code,
              error
            );
          }

          throw new CrovverError(
            "Request failed",
            error.response.status,
            undefined,
            error
          );
        }

        this.logger("Network Error", { message: error.message });
        throw new CrovverError(
          error.message || "Network error",
          undefined,
          "NETWORK_ERROR",
          error
        );
      }
    );
  }

  /**
   * Execute a request with automatic retry logic
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config: RetryConfig = {
      maxRetries: retryConfig?.maxRetries ?? this.config.maxRetries,
      baseDelay: retryConfig?.baseDelay ?? 1000,
      maxDelay: retryConfig?.maxDelay ?? 30000,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        const isCrovverError = error instanceof CrovverError;
        const isRetryable = isCrovverError ? error.isRetryable : true;

        if (!isRetryable || attempt >= config.maxRetries) {
          throw error;
        }

        const delay = calculateBackoff(
          attempt,
          config.baseDelay,
          config.maxDelay
        );
        this.logger(
          `Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  // ────────────────────────────────────────────────────────────────────────
  // TENANT MANAGEMENT
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Create a tenant: a workspace (B2B, pass `externalTenantId`) or an individual customer
   * (D2C, omit it — the tenant is keyed on `externalUserId`). A D2C checkout also creates
   * its tenant on its own, so this call is optional there.
   *
   * @param request - Tenant creation request
   * @returns Created tenant and owner information
   * @throws {CrovverError} If the tenant id or slug already exists
   *
   * @example
   * ```typescript
   * const result = await crovver.createTenant({
   *   externalTenantId: 'company-123',
   *   name: 'Acme Corporation',
   *   externalUserId: 'user-456',
   *   ownerEmail: 'admin@acme.com',
   * });
   * console.log('Tenant created:', result.tenant.id);
   * ```
   */
  async createTenant(
    request: CreateTenantRequest
  ): Promise<CreateTenantResponse> {
    return this.withRetry(async () => {
      const response = await this.client.post<CreateTenantResponse>(
        "/api/public/tenants",
        request
      );
      return response.data;
    });
  }

  /**
   * Get tenant information by external tenant ID
   *
   * @param externalTenantId - The external tenant ID from your SaaS app
   * @returns Tenant information with members
   *
   * @example
   * ```typescript
   * const { tenant, members } = await crovver.getTenant('company-123');
   * console.log(`Tenant: ${tenant.name}`);
   * console.log(`Members: ${members.length}`);
   * ```
   */
  async getTenant(externalTenantId: string): Promise<GetTenantResponse> {
    return this.withRetry(async () => {
      const response = await this.client.get<GetTenantResponse>(
        "/api/public/tenants",
        {
          params: { externalTenantId },
        }
      );
      return response.data;
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // PLANS
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Get all available plans for the organization
   *
   * Use this to render pricing pages or display upgrade options.
   *
   * @returns List of all active plans with pricing and features
   *
   * @example
   * ```typescript
   * const { plans } = await crovver.getPlans();
   * plans.forEach(plan => {
   *   console.log(`${plan.name}: $${plan.pricing.amount}/${plan.pricing.interval}`);
   * });
   * ```
   */
  async getPlans(): Promise<GetPlansResponse> {
    return this.withRetry(async () => {
      const response =
        await this.client.get<GetPlansResponse>("/api/public/plans");
      return response.data;
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Get active subscriptions for a tenant/user
   *
   * @param requestingEntityId - External tenant ID (B2B) or user ID (D2C)
   * @returns Active subscriptions with plan and billing details
   *
   * @example
   * ```typescript
   * const { subscriptions, tenant } = await crovver.getSubscriptions('company-123');
   * console.log(`${tenant.name} has ${subscriptions.length} subscriptions`);
   * ```
   */
  async getSubscriptions(
    requestingEntityId: string
  ): Promise<GetSubscriptionsResponse> {
    return this.withRetry(async () => {
      const response = await this.client.get<GetSubscriptionsResponse>(
        "/api/public/subscriptions",
        {
          params: { requestingEntityId },
        }
      );
      return response.data;
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // CHECKOUT
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Create a checkout session for payment
   *
   * For B2B: Provide externalUserId and externalTenantId
   * For D2C: Provide externalUserId, userEmail, and userName (tenant auto-created)
   *
   * @param request - Checkout session request
   * @returns Checkout URL to redirect the user to
   *
   * @example
   * ```typescript
   * // B2B checkout
   * const checkout = await crovver.createCheckoutSession({
   *   externalUserId: 'user-456',
   *   externalTenantId: 'company-123',
   *   planId: 'plan-uuid',
   *   provider: 'stripe',
   *   successUrl: 'https://myapp.com/success',
   *   cancelUrl: 'https://myapp.com/cancel',
   * });
   * window.location.href = checkout.checkoutUrl;
   * ```
   */
  async createCheckoutSession(
    request: CreateCheckoutSessionRequest
  ): Promise<CreateCheckoutSessionResponse> {
    // Checkout operations should not be retried to avoid duplicate payments
    const response = await this.client.post<CreateCheckoutSessionResponse>(
      "/api/public/checkout",
      request
    );
    return response.data;
  }

  // ────────────────────────────────────────────────────────────────────────
  // ENTITLEMENT CHECKS
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Check if a tenant/user can access a specific feature
   *
   * @param requestingEntityId - External tenant ID (B2B) or user ID (D2C)
   * @param featureKey - The feature key to check
   * @returns Whether access is allowed
   *
   * @example
   * ```typescript
   * const canAccess = await crovver.canAccess('company-123', 'advanced-analytics');
   * if (canAccess) {
   *   // Show the feature
   * } else {
   *   // Show upgrade prompt
   * }
   * ```
   */
  async canAccess(
    requestingEntityId: string,
    featureKey?: string,
    productSlug?: string
  ): Promise<boolean> {
    return this.withRetry(async () => {
      const response = await this.client.post<CanAccessResponse>(
        "/api/public/can-access",
        {
          requestingEntityId,
          ...(featureKey ? { featureKey } : {}),
          ...(productSlug ? { productSlug } : {}),
        }
      );
      return response.data.canAccess;
    });
  }

  /**
   * Check current usage and limits for a metric
   *
   * @param requestingEntityId - External tenant ID (B2B) or user ID (D2C)
   * @param metric - The metric key to check
   * @returns Usage information including current value, limit, and remaining
   *
   * @example
   * ```typescript
   * const usage = await crovver.checkUsageLimit('company-123', 'api-calls');
   * console.log(`Used: ${usage.current} / ${usage.limit}`);
   * console.log(`Remaining: ${usage.remaining}`);
   * ```
   */
  async checkUsageLimit(
    requestingEntityId: string,
    metric: string,
    productSlug?: string
  ): Promise<CheckUsageLimitResponse> {
    return this.withRetry(async () => {
      const response = await this.client.post<CheckUsageLimitResponse>(
        "/api/public/check-usage-limit",
        {
          requestingEntityId,
          metric,
          ...(productSlug ? { productSlug } : {}),
        }
      );
      return response.data;
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // PRORATION (Seat-Based Plans)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Create a proration checkout session for a mid-cycle seat capacity upgrade.
   *
   * The proration amount is calculated server-side. After successful payment
   * the webhook will upgrade the subscription capacity automatically.
   *
   * @param params - Proration checkout details
   * @returns Checkout URL, proration ID, and calculated amount
   *
   * @example
   * ```typescript
   * const checkout = await crovver.createProrationCheckout({
   *   externalTenantId: 'company-123',
   *   newCapacity: 15,
   *   planId: 'plan-uuid',          // optional
   *   successUrl: 'https://myapp.com/success',
   *   cancelUrl: 'https://myapp.com/cancel',
   * });
   *
   * if (checkout.checkoutUrl) {
   *   window.location.href = checkout.checkoutUrl;
   * }
   * ```
   */
  async createProrationCheckout(
    params: CreateProrationCheckoutRequest
  ): Promise<CreateProrationCheckoutResponse> {
    // Payment operations should not be retried to avoid duplicate charges
    const response = await this.client.post<CreateProrationCheckoutResponse>(
      "/api/public/capacity/proration-checkout",
      {
        externalTenantId: params.externalTenantId,
        newCapacity: params.newCapacity,
        planId: params.planId,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      }
    );
    return response.data;
  }

  // ────────────────────────────────────────────────────────────────────────
  // SUBSCRIPTION MANAGEMENT
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Cancel an active subscription.
   *
   * The subscription remains active until the end of the current billing
   * period (cancel-at-period-end behaviour).
   *
   * @param subscriptionId - The Crovver subscription ID
   * @param externalTenantId - External tenant ID (for verification)
   * @param reason - Cancellation reason (required by the API)
   * @param feedback - Optional free-text feedback
   *
   * @example
   * ```typescript
   * const result = await crovver.cancelSubscription(
   *   'sub-uuid',
   *   'company-123',
   *   'too_expensive',
   *   'Pricing is a bit high for our team size',
   * );
   * console.log(`Subscription ends at: ${result.willEndAt}`);
   * ```
   */
  async cancelSubscription(
    subscriptionId: string,
    externalTenantId: string,
    reason: string,
    feedback?: string
  ): Promise<CancelSubscriptionResponse> {
    return this.withRetry(async () => {
      const response = await this.client.post<CancelSubscriptionResponse>(
        `/api/public/subscriptions/${subscriptionId}/cancel`,
        { externalTenantId, reason, feedback }
      );
      return response.data;
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // BILLING / INVOICES
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Get invoices for a tenant.
   *
   * @param externalTenantId - External tenant ID
   * @returns List of invoices
   *
   * @example
   * ```typescript
   * const { invoices } = await crovver.getInvoices('company-123');
   * invoices.forEach(inv => {
   *   console.log(`${inv.invoice_number}: ${inv.total_amount} ${inv.currency}`);
   * });
   * ```
   */
  async getInvoices(externalTenantId: string): Promise<GetInvoicesResponse> {
    return this.withRetry(async () => {
      const response = await this.client.get<GetInvoicesResponse>(
        "/api/public/billing/invoices",
        { params: { externalTenantId } }
      );
      return response.data;
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // PAYMENT PROVIDERS
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Get list of supported payment providers
   *
   * Returns all payment providers available on the Crovver platform.
   *
   * @returns List of supported payment providers
   *
   * @example
   * ```typescript
   * const { providers } = await crovver.getSupportedProviders();
   * providers.forEach(p => console.log(`${p.name}: ${p.code}`));
   * ```
   */
  async getSupportedProviders(): Promise<GetSupportedProvidersResponse> {
    return this.withRetry(async () => {
      const response = await this.client.get<GetSupportedProvidersResponse>(
        "/api/public/supported-providers"
      );
      return response.data;
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // CREDITS
  // ────────────────────────────────────────────────────────────────────────

  credits = {
    /**
     * Consume credits from a named pool. Idempotent — safe to retry with the
     * same idempotencyKey. Use a stable key derived from the event (e.g.
     * `job_post:create:${jobId}`), never a random UUID.
     *
     * @example
     * const result = await crovver.credits.consume({
     *   tenantId: 'company-123',
     *   poolKey: 'job_posts',
     *   amount: 1,
     *   idempotencyKey: `job_post:create:${jobId}`,
     * });
     * if (result.result === 'blocked') throw new Error('Credit limit reached');
     */
    consume: async (input: ConsumeInput): Promise<ConsumeResponse> => {
      return this.withRetry(async () => {
        const response = await this.client.post<ConsumeResponse>(
          "/api/public/credits/consume",
          input
        );
        return response.data;
      });
    },

    /**
     * Get credit balance for a tenant, keyed by pool_key.
     *
     * @example
     * const balance = await crovver.credits.balance({ tenantId: 'company-123' });
     * console.log(balance.job_posts.total); // 45
     */
    balance: async (input: { tenantId: string; subscriptionId?: string; productSlug?: string }): Promise<BalanceResponse> => {
      return this.withRetry(async () => {
        const response = await this.client.get<BalanceResponse>(
          `/api/public/credits/balance`,
          {
            params: {
              tenantId: input.tenantId,
              ...(input.subscriptionId && { subscriptionId: input.subscriptionId }),
              ...(input.productSlug && { productSlug: input.productSlug }),
            },
          }
        );
        return response.data;
      });
    },
  };

  // ────────────────────────────────────────────────────────────────────────
  // CAPACITY / SEAT ALLOCATION
  // ────────────────────────────────────────────────────────────────────────

  capacity = {
    /**
     * Bulk-allocate multiple users to a tenant's active subscription in one
     * atomic operation. Up to 100 users per request.
     *
     * - Users already active are skipped (idempotent).
     * - Users that would exceed `capacity_units` are returned as `rejected`.
     * - No proration — upgrade capacity first if needed.
     *
     * @example
     * const result = await crovver.capacity.bulkAllocate({
     *   requestingEntityId: 'company-123',
     *   users: [
     *     { externalUserId: 'u1', email: 'alice@co.com', name: 'Alice' },
     *     { externalUserId: 'u2', email: 'bob@co.com',   name: 'Bob'   },
     *     { externalUserId: 'u3', email: 'carol@co.com', name: 'Carol' },
     *   ],
     * });
     * console.log(`Allocated: ${result.allocated.length}`);
     * console.log(`Rejected (over capacity): ${result.rejected.length}`);
     */
    bulkAllocate: async (
      request: BulkAllocateSeatsRequest
    ): Promise<BulkAllocateSeatsResponse> => {
      // Not retried — prevents duplicate allocations on network retry
      const response = await this.client.post<BulkAllocateSeatsResponse>(
        "/api/public/capacity/bulk-allocate",
        request
      );
      return response.data;
    },

    /**
     * List capacity allocations for a tenant.
     *
     * Returns the users allocated to the tenant's active subscription,
     * along with a capacity summary and pagination metadata.
     *
     * @example
     * const result = await crovver.capacity.getAllocations({
     *   requestingEntityId: 'company-123',
     * });
     * console.log(result.allocations); // [{ externalUserId, email, name, ... }]
     *
     * // Page through all users (active + removed)
     * const page2 = await crovver.capacity.getAllocations({
     *   requestingEntityId: 'company-123',
     *   status: 'all',
     *   page: 2,
     *   limit: 25,
     * });
     */
    getAllocations: async (
      request: GetAllocationsRequest
    ): Promise<GetAllocationsResponse> => {
      return this.withRetry(async () => {
        const params = new URLSearchParams({
          requestingEntityId: request.requestingEntityId,
          ...(request.status !== undefined && { status: request.status }),
          ...(request.page   !== undefined && { page:   String(request.page)  }),
          ...(request.limit  !== undefined && { limit:  String(request.limit) }),
        });
        const response = await this.client.get<GetAllocationsResponse>(
          `/api/public/capacity/allocations?${params}`
        );
        return response.data;
      });
    },

    /**
     * Take a user's seat away, at once. The seat stays on the subscription,
     * vacant, so the next allocation can use it straight away: capacity, the
     * payment provider and the price are unchanged (seats are reduced at
     * renewal; nothing is refunded).
     *
     * Safe to retry: removing a user who is already removed returns
     * `alreadyRemoved: true`. A user who never had a seat is a 404.
     *
     * @example
     * const { capacity } = await crovver.capacity.remove({
     *   requestingEntityId: 'company-123',
     *   externalUserId: 'u2',
     * });
     * console.log(`${capacity.vacantSeats} seats free`);
     */
    remove: async (request: RemoveSeatRequest): Promise<RemoveSeatResponse> => {
      return this.withRetry(async () => {
        const response = await this.client.post<RemoveSeatResponse>(
          "/api/public/capacity/remove",
          request
        );
        return response.data;
      });
    },
  };

  addons = {
    /**
     * List addons available for purchase by a tenant, filtered by their active
     * subscription plan and currency.
     *
     * @param externalTenantId - External tenant ID
     * @returns Available addons with current balance and pricing
     */
    listAvailable: async (
      externalTenantId: string
    ): Promise<AvailableAddon[]> => {
      return this.withRetry(async () => {
        const response = await this.client.get<AvailableAddon[]>(
          `/api/public/tenants/${encodeURIComponent(externalTenantId)}/addons/available`
        );
        return response.data;
      });
    },

    /**
     * Initiate an addon purchase checkout. Idempotent — pass the same
     * idempotencyKey to safely retry without double-charging.
     *
     * Credits are granted by the webhook after payment is confirmed.
     *
     * @param externalTenantId - External tenant ID
     * @param params - Purchase parameters
     * @returns Checkout URL (redirect user) or null for non-Stripe providers
     */
    purchase: async (
      externalTenantId: string,
      params: AddonPurchaseRequest
    ): Promise<AddonPurchaseResponse> => {
      // Payment operations must not be retried to avoid duplicate charges
      const response = await this.client.post<AddonPurchaseResponse>(
        `/api/public/tenants/${encodeURIComponent(externalTenantId)}/addons/purchase`,
        params
      );
      return response.data;
    },

    /**
     * Get addon credit balances for a tenant, grouped by pool_key.
     * Only shows pools where addon credits are remaining (> 0).
     *
     * @param externalTenantId - External tenant ID
     * @returns Active addon pool balances
     */
    getActive: async (externalTenantId: string, subscriptionId?: string): Promise<ActiveAddonPool[]> => {
      return this.withRetry(async () => {
        const response = await this.client.get<ActiveAddonPool[]>(
          `/api/public/tenants/${encodeURIComponent(externalTenantId)}/addons/active`,
          { params: subscriptionId ? { subscriptionId } : undefined }
        );
        return response.data;
      });
    },
  };
}

export default CrovverClient;
