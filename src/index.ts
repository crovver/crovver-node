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
  /** Your SaaS app's company/workspace ID */
  externalTenantId: string;
  /** Company/workspace name */
  name: string;
  /** URL-friendly slug (optional, auto-generated from name if not provided) */
  slug?: string;
  /** Owner's user ID from your app */
  externalUserId: string;
  /** Owner's email (optional) */
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
    type: "b2b" | "d2c";
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
}

export interface PlanTrial {
  days: number;
  available: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
}

export interface PaymentProviderMapping {
  provider_id: string;
  provider_type: string;
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

export interface Plan {
  id: string;
  name: string;
  description?: string;
  pricing: PlanPricing;
  trial: PlanTrial;
  test_mode: boolean;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  product: Product;
  payment_providers: PaymentProviderMapping[];
  created_at: string;
  updated_at: string;
}

export interface GetPlansResponse {
  plans: Plan[];
  organization: {
    id: string;
    name: string;
    type: "b2b" | "d2c";
  };
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
  limits: Record<string, number | null>;
}

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

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
    type: "b2b" | "d2c";
  };
}

// ────────────────────────────────────────────────────────────────────────
// Checkout Types
// ────────────────────────────────────────────────────────────────────────

export type PaymentProvider = "stripe" | "paddle" | "lemonsqueezy";

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
  /** Number of seats to purchase (for seat-based plans) */
  quantity?: number;
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

export interface RecordUsageRequest {
  /** External tenant ID (B2B) or user ID (D2C) */
  requestingEntityId: string;
  /** Metric key to record usage for */
  metric: string;
  /** Usage value (default: 1) */
  value?: number;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

export interface RecordUsageResponse {
  success: boolean;
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
  prorationId: string;
  checkoutUrl: string | null;
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
  // TENANT MANAGEMENT (B2B Only)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Create a new tenant (B2B organizations only)
   *
   * For D2C organizations, tenants are automatically created during checkout.
   *
   * @param request - Tenant creation request
   * @returns Created tenant and owner information
   * @throws {CrovverError} If the organization is D2C or tenant already exists
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
          params: { externalUserId: externalTenantId },
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
    featureKey: string
  ): Promise<boolean> {
    return this.withRetry(async () => {
      const response = await this.client.post<CanAccessResponse>(
        "/api/public/can-access",
        {
          requestingEntityId,
          featureKey,
        }
      );
      return response.data.canAccess;
    });
  }

  /**
   * Record usage for a metric
   *
   * @param requestingEntityId - External tenant ID (B2B) or user ID (D2C)
   * @param metric - The metric key to record usage for
   * @param value - Usage value (default: 1)
   * @param metadata - Optional metadata
   *
   * @example
   * ```typescript
   * await crovver.recordUsage('company-123', 'api-calls', 1, {
   *   endpoint: '/api/v1/users',
   *   method: 'GET'
   * });
   * ```
   */
  async recordUsage(
    requestingEntityId: string,
    metric: string,
    value: number = 1,
    metadata?: Record<string, unknown>
  ): Promise<RecordUsageResponse> {
    return this.withRetry(async () => {
      const response = await this.client.post<RecordUsageResponse>(
        "/api/public/record-usage",
        {
          requestingEntityId,
          metric,
          value,
          metadata,
        }
      );
      return response.data;
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
    metric: string
  ): Promise<CheckUsageLimitResponse> {
    return this.withRetry(async () => {
      const response = await this.client.post<CheckUsageLimitResponse>(
        "/api/public/check-usage-limit",
        {
          requestingEntityId,
          metric,
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
}

export default CrovverClient;
