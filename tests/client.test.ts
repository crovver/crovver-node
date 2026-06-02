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

  describe("recordUsage", () => {
    it("sends metric without productSlug", async () => {
      const http = mockInstance({ message: "Usage recorded", metric: "api_calls", recordedValue: 1 });
      const client = new CrovverClient({ apiKey: "sk_test" });
      await client.recordUsage("tenant-1", "api_calls", 1);
      expect(http.post).toHaveBeenCalledWith(
        "/api/public/record-usage",
        expect.objectContaining({ requestingEntityId: "tenant-1", metric: "api_calls" })
      );
    });

    it("includes productSlug when provided", async () => {
      const http = mockInstance({ message: "Usage recorded", metric: "api_calls", recordedValue: 1 });
      const client = new CrovverClient({ apiKey: "sk_test" });
      await client.recordUsage("tenant-1", "api_calls", 1, undefined, "ats");
      expect(http.post).toHaveBeenCalledWith(
        "/api/public/record-usage",
        expect.objectContaining({ productSlug: "ats" })
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
