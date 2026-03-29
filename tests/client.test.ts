import { CrovverClient, CrovverError } from "../src/index";

describe("CrovverClient", () => {
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
