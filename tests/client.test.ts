import axios from "axios";
import { CrovverClient, CrovverError } from "../src/index";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Minimal axios instance mock
function mockInstance(responseData: unknown, status = 200) {
  const instance = {
    post: jest.fn().mockResolvedValue({ data: responseData, status }),
    get:  jest.fn().mockResolvedValue({ data: responseData, status }),
    interceptors: {
      request:  { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  mockedAxios.create.mockReturnValue(instance as any);
  return instance;
}

describe("CrovverClient", () => {
  // Ensure every test that calls new CrovverClient() gets a valid axios instance.
  // Individual tests override post/get responses via mockInstance() as needed.
  beforeEach(() => {
    mockInstance({});
  });
  describe("constructor", () => {
    it("throws if apiKey is empty", () => {
      expect(() => new CrovverClient({ apiKey: "" })).toThrow(
        "CrovverConfig.apiKey is required"
      );
    });

    it("instantiates with a valid apiKey", () => {
      const client = new CrovverClient({ apiKey: "test-key" });
      expect(client).toBeInstanceOf(CrovverClient);
    });

    it("accepts a custom baseUrl for local development", () => {
      const client = new CrovverClient({
        apiKey: "test-key",
        baseUrl: "http://localhost:3000",
      });
      expect(client).toBeInstanceOf(CrovverClient);
    });
  });

  // The response interceptor in the SDK unwraps ApiResponse<T> (sets response.data = apiResponse.data)
  // so mock data should be the already-unwrapped payload that methods read from response.data.

  describe("canAccess", () => {
    it("sends featureKey without productSlug", async () => {
      const http = mockInstance({ canAccess: true });
      const client = new CrovverClient({ apiKey: "sk_test" });
      const result = await client.canAccess("tenant-1", "feature-x");
      expect(result).toBe(true);
      expect(http.post).toHaveBeenCalledWith(
        "/api/public/can-access",
        { requestingEntityId: "tenant-1", featureKey: "feature-x" }
      );
    });

    it("includes productSlug when provided", async () => {
      const http = mockInstance({ canAccess: false });
      const client = new CrovverClient({ apiKey: "sk_test" });
      const result = await client.canAccess("tenant-1", "feature-x", "ats");
      expect(result).toBe(false);
      expect(http.post).toHaveBeenCalledWith(
        "/api/public/can-access",
        { requestingEntityId: "tenant-1", featureKey: "feature-x", productSlug: "ats" }
      );
    });

    it("omits featureKey for subscription-existence check", async () => {
      const http = mockInstance({ canAccess: true });
      const client = new CrovverClient({ apiKey: "sk_test" });
      const result = await client.canAccess("tenant-1", undefined, "ats");
      expect(result).toBe(true);
      expect(http.post).toHaveBeenCalledWith(
        "/api/public/can-access",
        { requestingEntityId: "tenant-1", productSlug: "ats" }
      );
    });
  });

  describe("createTenant", () => {
    const created = { tenant: { id: "t-1" }, owner: { id: "o-1" }, message: "Tenant created successfully" };

    it("creates a D2C customer without externalTenantId", async () => {
      const http = mockInstance(created);
      const client = new CrovverClient({ apiKey: "sk_test" });
      await client.createTenant({ name: "Ada", externalUserId: "user-1", ownerEmail: "ada@example.com" });
      expect(http.post).toHaveBeenCalledWith(
        "/api/public/tenants",
        { name: "Ada", externalUserId: "user-1", ownerEmail: "ada@example.com" }
      );
    });

    it("still sends externalTenantId for a B2B workspace", async () => {
      const http = mockInstance(created);
      const client = new CrovverClient({ apiKey: "sk_test" });
      await client.createTenant({ externalTenantId: "ws-1", name: "Acme", externalUserId: "user-1" });
      expect(http.post).toHaveBeenCalledWith(
        "/api/public/tenants",
        { externalTenantId: "ws-1", name: "Acme", externalUserId: "user-1" }
      );
    });
  });

  describe("capacity.remove", () => {
    it("posts the tenant and the user, and returns the vacant capacity", async () => {
      const removed = {
        externalUserId: "u2",
        alreadyRemoved: false,
        removedAt: "2026-10-18T12:00:00.000Z",
        capacity: { activeCount: 2, capacityUnits: 5, vacantSeats: 3 },
      };
      const http = mockInstance(removed);
      const client = new CrovverClient({ apiKey: "sk_test" });
      const result = await client.capacity.remove({ requestingEntityId: "ws-1", externalUserId: "u2" });
      expect(http.post).toHaveBeenCalledWith("/api/public/capacity/remove", { requestingEntityId: "ws-1", externalUserId: "u2" });
      expect(result.capacity.vacantSeats).toBe(3);
    });
  });

  describe("checkUsageLimit", () => {
    it("sends metric without productSlug", async () => {
      const http = mockInstance({ allowed: true, current: 5, limit: 100, remaining: 95, percentage: 5, metric: "api_calls" });
      const client = new CrovverClient({ apiKey: "sk_test" });
      await client.checkUsageLimit("tenant-1", "api_calls");
      expect(http.post).toHaveBeenCalledWith(
        "/api/public/check-usage-limit",
        { requestingEntityId: "tenant-1", metric: "api_calls" }
      );
    });

    it("includes productSlug when provided", async () => {
      const http = mockInstance({ allowed: true, current: 0, limit: 100, remaining: 100, percentage: 0, metric: "api_calls" });
      const client = new CrovverClient({ apiKey: "sk_test" });
      await client.checkUsageLimit("tenant-1", "api_calls", "ats");
      expect(http.post).toHaveBeenCalledWith(
        "/api/public/check-usage-limit",
        { requestingEntityId: "tenant-1", metric: "api_calls", productSlug: "ats" }
      );
    });
  });

  describe("CrovverError", () => {
    it("marks 5xx errors as retryable", () => {
      const err = new CrovverError("Server error", 500);
      expect(err.isRetryable).toBe(true);
    });

    it("marks 429 rate limit as retryable", () => {
      const err = new CrovverError("Rate limited", 429);
      expect(err.isRetryable).toBe(true);
    });

    it("marks 4xx errors as non-retryable", () => {
      const err = new CrovverError("Not found", 404);
      expect(err.isRetryable).toBe(false);
    });

    it("marks network errors (no status) as retryable", () => {
      const err = new CrovverError("Network error");
      expect(err.isRetryable).toBe(true);
    });

    it("serializes to JSON correctly", () => {
      const err = new CrovverError("Unauthorized", 401, "UNAUTHORIZED");
      expect(err.toJSON()).toEqual({
        name: "CrovverError",
        message: "Unauthorized",
        statusCode: 401,
        code: "UNAUTHORIZED",
        isRetryable: false,
      });
    });
  });
});

describe("planPeriodCharge", () => {
  const { planPeriodCharge, seatTierFor } = require("../src/index");
  const tiered = {
    isFree: false,
    isSeatBased: true,
    pricing: { currency: "USD", interval: "monthly", isSeatBased: true, basePrice: 0, includedSeats: 10, perSeatPrice: 0 },
    prices: [{ currency: "USD", amount: null, basePrice: 0, perSeatPrice: 0 }],
    seatTiers: [
      { currency: "USD", minQuantity: 1, maxQuantity: 10, price: "80.00" },
      { currency: "USD", minQuantity: 11, maxQuantity: 50, price: "250.00" },
      { currency: "USD", minQuantity: 51, maxQuantity: null, price: "400.00" },
    ],
  };

  it("prices a tiered plan by the band holding the seat count, not seats × a band", () => {
    expect(planPeriodCharge(tiered, 10)).toBe(80);
    expect(planPeriodCharge(tiered, 11)).toBe(250);
    expect(planPeriodCharge(tiered, 500)).toBe(400);
    expect(seatTierFor(tiered.seatTiers, "usd", 50)?.minQuantity).toBe(11);
  });

  it("is null for a count no band holds, or a currency the plan has no price in", () => {
    expect(planPeriodCharge({ ...tiered, seatTiers: tiered.seatTiers.slice(0, 2) }, 51)).toBeNull();
    expect(planPeriodCharge({ ...tiered, seatTiers: [] }, 1, "EUR")).toBeNull();
  });

  it("keeps base + extra seats × per seat for a plan without bands, and the amount for a flat plan", () => {
    const perSeat = {
      ...tiered,
      seatTiers: [],
      pricing: { ...tiered.pricing, includedSeats: 5 },
      prices: [{ currency: "USD", amount: null, basePrice: 50, perSeatPrice: 5 }],
    };
    expect(planPeriodCharge(perSeat, 8)).toBe(65);
    expect(planPeriodCharge(perSeat, 2)).toBe(50);
    const flat = { isFree: false, isSeatBased: false, pricing: { currency: "USD", interval: "monthly", isSeatBased: false }, prices: [{ currency: "USD", amount: 29, basePrice: null, perSeatPrice: null }] };
    expect(planPeriodCharge(flat, 1)).toBe(29);
    expect(planPeriodCharge({ ...flat, isFree: true }, 1)).toBe(0);
  });
});
