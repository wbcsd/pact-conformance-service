import { jest } from "@jest/globals";
import { runTestCase } from "./runTestCase";
import { TestCaseResultStatus } from "../services/types";

type AnyObj = Record<string, any>;

const BASE_URL = "https://api.example.com";
const ACCESS_TOKEN = "test-access-token";
const VERSION = "v1";

const makeHeaders = (obj: Record<string, string> = {}) => ({
  get: (k: string) => (k in obj ? obj[k] : null),
  has: (k: string) => k in obj,
});

const mockFetchOk = (
  status = 200,
  body = "{}",
  headers: Record<string, string> = {}
) => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status,
    text: jest.fn().mockResolvedValue(body as never),
    headers: makeHeaders({ ...headers, "Content-Type": "application/json" }),
  } as never);
};

const mockFetchErrorJson = (status: number, body = "{}") => {
  (global.fetch as jest.Mock).mockResolvedValue({
    status,
    ok: false,
    text: jest.fn().mockResolvedValue(body as never),
    headers: makeHeaders({ "Content-Type": "application/json" }),
  } as never);
};

const mockFetchReject = (error: any) => {
  (global.fetch as jest.Mock).mockRejectedValue(error as never);
};

describe("runTestCase", () => {
  beforeAll(() => {
    // Silence module logs in tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    // Ensure AbortSignal.timeout exists for the request path
    if (!(AbortSignal as AnyObj).timeout) {
      (AbortSignal as AnyObj).timeout = (ms: number) => {
        const c = new AbortController();
        setTimeout(() => c.abort(), ms);
        return c.signal;
      };
    }
  });

  beforeEach(() => {
    (global as AnyObj).fetch = jest.fn();
    jest.clearAllMocks();
  });

  it("happy path: GET, endpoint, 200 OK, no schema/condition", async () => {
    mockFetchOk(200, JSON.stringify({ ok: true }));

    const res = await runTestCase(
      BASE_URL,
      {
        name: "simple-get",
        method: "GET",
        endpoint: "/health",
        expectedStatusCodes: [200],
        testKey: "T-2",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE_URL}/health`);
    expect((options as RequestInit).method).toBe("GET");
    expect((options as any).headers["Content-Type"]).toBe("application/json");
    expect((options as any).headers["Authorization"]).toBe(
      `Bearer ${ACCESS_TOKEN}`
    );
    expect((options as RequestInit).body).toBeUndefined();

    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
    // Curl contains method, URL, auth header, content-type; no -d
    expect(res.curlRequest).toContain(
      "curl -X GET 'https://api.example.com/health'"
    );
    expect(res.curlRequest).toContain(
      " -H 'Authorization: Bearer test-access-token'"
    );
    expect(res.curlRequest).toContain(" -H 'Content-Type: application/json'");
    expect(res.curlRequest).not.toContain(" -d '");
  });

  it("uses customUrl over baseUrl+endpoint and merges/overrides headers; string body appears in curl", async () => {
    mockFetchOk(200, "");

    const res = await runTestCase(
      BASE_URL,
      {
        name: "custom-url-post",
        method: "POST",
        customUrl: "https://alt.example.net/echo",
        requestData: "raw-body",
        headers: {
          "Content-Type": "text/plain", // overrides default
          "X-Test": "1",
        },
        expectedStatusCodes: [200],
        testKey: "T-3",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://alt.example.net/echo");
    expect((options as any).method).toBe("POST");
    // overridden header persists
    expect((options as any).headers["Content-Type"]).toBe("text/plain");
    expect((options as any).headers["X-Test"]).toBe("1");
    expect((options as any).body).toBe("raw-body");

    // Curl contains headers & -d; order-insensitive checks
    expect(res.curlRequest).toContain(
      "curl -X POST 'https://alt.example.net/echo'"
    );
    expect(res.curlRequest).toContain(
      " -H 'Authorization: Bearer test-access-token'"
    );
    expect(res.curlRequest).toContain(" -H 'Content-Type: text/plain'");
    expect(res.curlRequest).toContain(" -H 'X-Test: 1'");
    expect(res.curlRequest).toContain(" -d 'raw-body'");
    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
  });

  it("fails when expectedStatusCodes do not include actual status", async () => {
    mockFetchOk(200, "{}");

    const res = await runTestCase(
      BASE_URL,
      {
        name: "status-mismatch",
        method: "GET",
        endpoint: "/created",
        expectedStatusCodes: [201],
        testKey: "T-4",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.FAILURE);
    expect(res.errorMessage).toBe("Expected status [201], but got 200");
  });

  it("parses JSON; invalid JSON triggers failure in catch", async () => {
    mockFetchOk(200, "not-json");

    const res = await runTestCase(
      BASE_URL,
      {
        name: "invalid-json",
        method: "GET",
        endpoint: "/bad-json",
        expectedStatusCodes: [200],
        testKey: "T-5",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.FAILURE);
    // Engine-specific message, keep assertion tolerant:
    expect(res.errorMessage).toMatch(/Unexpected|JSON/i);
  });

  it("schema validation fails when response violates schema", async () => {
    mockFetchOk(200, JSON.stringify({ id: "oops" }));

    const res = await runTestCase(
      BASE_URL,
      {
        name: "schema-fail",
        method: "GET",
        endpoint: "/schema",
        expectedStatusCodes: [200],
        schema: {
          type: "object",
          properties: { id: { type: "number" } },
          required: ["id"],
          additionalProperties: false,
        },
        testKey: "T-6",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.FAILURE);
    expect(res.errorMessage).toContain("Schema validation failed:");
    expect(res.apiResponse).toBe(JSON.stringify({ id: "oops" }));
  });

  it("schema validation passes and condition passes -> success", async () => {
    mockFetchOk(200, JSON.stringify({ id: "abc" }), { "x-flag": "ok"});

    const res = await runTestCase(
      BASE_URL,
      {
        name: "schema-ok-condition-ok",
        method: "GET",
        endpoint: "/ok",
        expectedStatusCodes: [200],
        schema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
          additionalProperties: false,
        },
        condition: (data: any) =>
          data.id === "abc",
        testKey: "T-7",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
  });

  it("condition fails -> failure with provided conditionErrorMessage", async () => {
    mockFetchOk(200, JSON.stringify({ id: 1 }));

    const res = await runTestCase(
      BASE_URL,
      {
        name: "condition-fail",
        method: "GET",
        endpoint: "/cond",
        expectedStatusCodes: [200],
        condition: () => false,
        conditionErrorMessage: "Condition failed!",
        testKey: "T-8",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.FAILURE);
    expect(res.errorMessage).toBe("Condition failed!");
    expect(res.apiResponse).toBe(JSON.stringify({ id: 1 }));
  });

  it("timeout error returns SUCCESS when expectHttpError is true", async () => {
    mockFetchReject({ name: "AbortError", message: "aborted" });

    const res = await runTestCase(
      BASE_URL,
      {
        name: "timeout-ignored",
        method: "GET",
        endpoint: "/slow",
        expectedStatusCodes: [200],
        expectHttpError: true,
        testKey: "T-9",
        mandatoryVersion: ["v2"], // not current version -> false
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
    // default timeout is 5000ms unless env overrides at module-load time
    expect(res.mandatory).toBe(false);
  });

  it("timeout error returns FAILURE when ignoreTimeoutErrors is false/omitted", async () => {
    mockFetchReject({ name: "AbortError", message: "aborted" });

    const res = await runTestCase(
      BASE_URL,
      {
        name: "timeout-fail",
        method: "GET",
        endpoint: "/slow",
        expectedStatusCodes: [200],
        testKey: "T-10",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.FAILURE);
    expect(res.errorMessage).toBe("Request timeout after 5000ms");
  });

  it("no expectedStatusCodes: non-200 can still succeed (schema/condition absent)", async () => {
    mockFetchOk(503, "");

    const res = await runTestCase(
      BASE_URL,
      {
        name: "no-expected-codes",
        method: "GET",
        endpoint: "/maybe",
        // expectedStatusCodes omitted
        testKey: "T-11",
        mandatoryVersion: ["v1"], // current version -> true
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
    expect(res.mandatory).toBe(true);
  });

  it("object requestData is JSON-stringified and appears in curl -d", async () => {
    mockFetchOk(200, "{}");

    const payload = { a: 1, b: "x" };

    const res = await runTestCase(
      BASE_URL,
      {
        name: "json-body",
        method: "POST",
        endpoint: "/items",
        requestData: payload,
        expectedStatusCodes: [200],
        headers: { "X-Trace": "on" },
        testKey: "T-12",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect((options as Response).body).toBe(JSON.stringify(payload));
    expect(res.curlRequest).toContain(` -d '${JSON.stringify(payload)}'`);
    expect(res.curlRequest).toContain(" -H 'X-Trace: on'");
  });

  it("should fail for 200 when expectHttpError is true", async () => {
    mockFetchOk(200, JSON.stringify({ id: 1 }));

    const res = await runTestCase(
      BASE_URL,
      {
        name: "expectHttpError-success",
        method: "GET",
        endpoint: "/success",
        expectHttpError: true,
        expectedStatusCodes: [200],
        testKey: "T-13",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.FAILURE);
  });

  it("should succeed for 500 when expectHttpError is true", async () => {
    mockFetchErrorJson(500);

    const res = await runTestCase(
      BASE_URL,
      {
        name: "expectHttpError-failure",
        method: "GET",
        endpoint: "/error",
        expectedStatusCodes: [200],
        expectHttpError: true,
        testKey: "T-14",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
  });

  it("returns PENDING status for callback test cases", async () => {
    const res = await runTestCase(
      BASE_URL,
      {
        name: "callback-test",
        method: "POST",
        endpoint: "/callback",
        callback: true,
        requestData: { test: "data" },
        testKey: "T-15",
        mandatoryVersion: ["v1"], // current version -> true
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    // Should not make any fetch calls for callback tests
    expect(global.fetch).not.toHaveBeenCalled();
    
    expect(res.status).toBe(TestCaseResultStatus.PENDING);
    expect(res.mandatory).toBe(true);
    expect(res.curlRequest).toContain("Bearer YOUR-TOKEN-HERE");
    expect(res.curlRequest).not.toContain(ACCESS_TOKEN);
    expect(res.curlRequest).toContain(`-d '${JSON.stringify({ test: "data" })}'`);
  });

  it("fails condition validation and combines messages with conditionErrorMessage", async () => {
    mockFetchOk(200, JSON.stringify({ value: 10 }));

    const res = await runTestCase(
      BASE_URL,
      {
        name: "condition-fail-with-messages",
        method: "GET",
        endpoint: "/data",
        expectedStatusCodes: [200],
        condition: (data: any, messages: string[]) => {
          messages.push("Value check failed");
          return data.value === 42;
        },
        conditionErrorMessage: "Custom error message",
        testKey: "T-19",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.FAILURE);
    expect(res.errorMessage).toBe("Value check failed, Custom error message");
  });

  it("handles network errors that are not timeout errors", async () => {
    mockFetchReject(new Error("Network connection failed"));

    const res = await runTestCase(
      BASE_URL,
      {
        name: "network-error",
        method: "GET",
        endpoint: "/network-fail",
        expectedStatusCodes: [200],
        testKey: "T-20",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.FAILURE);
    expect(res.errorMessage).toBe("Network connection failed");
  });

  it("succeeds on network error when expectHttpError is true", async () => {
    mockFetchReject(new Error("Connection refused"));

    const res = await runTestCase(
      BASE_URL,
      {
        name: "network-error-expected",
        method: "GET",
        endpoint: "/connection-fail",
        expectHttpError: true,
        testKey: "T-21",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
    expect(res.errorMessage).toContain("Connection refused");
  });

  it("handles multiple expected status codes with success", async () => {
    mockFetchOk(201, "{}");

    const res = await runTestCase(
      BASE_URL,
      {
        name: "multiple-status-codes",
        method: "POST",
        endpoint: "/create",
        expectedStatusCodes: [200, 201, 202],
        requestData: { name: "test" },
        testKey: "T-23",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
  });

  it("sets mandatory flag false when no mandatoryVersion is specified", async () => {
    mockFetchOk(200, "{}");

    const res = await runTestCase(
      BASE_URL,
      {
        name: "no-mandatory-version",
        method: "GET",
        endpoint: "/optional",
        expectedStatusCodes: [200],
        testKey: "T-24",
        // mandatoryVersion is undefined
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.mandatory).toBe(false);
    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
  });

  it("sets mandatory flag false when current version is not in mandatoryVersion array", async () => {
    mockFetchOk(200, "{}");

    const res = await runTestCase(
      BASE_URL,
      {
        name: "version-not-mandatory",
        method: "GET",
        endpoint: "/optional",
        expectedStatusCodes: [200],
        mandatoryVersion: ["v2", "v3"], // current version "v1" not in array
        testKey: "T-25",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.mandatory).toBe(false);
    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
  });

  it("includes documentationUrl in result when provided", async () => {
    mockFetchOk(200, "{}");

    const docUrl = "https://example.com/docs/test-case";
    const res = await runTestCase(
      BASE_URL,
      {
        name: "with-documentation",
        method: "GET",
        endpoint: "/docs",
        expectedStatusCodes: [200],
        testKey: "T-26",
        documentationUrl: docUrl,
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.documentationUrl).toBe(docUrl);
    expect(res.status).toBe(TestCaseResultStatus.SUCCESS);
  });

  it("handles schema validation with complex nested errors", async () => {
    const complexInvalidData = {
      user: {
        id: "should-be-number",
        email: "not-an-email",
        age: -5
      },
      items: [
        { name: 123 }, // should be string
        { name: "valid" }
      ]
    };
    mockFetchOk(200, JSON.stringify(complexInvalidData));

    const res = await runTestCase(
      BASE_URL,
      {
        name: "complex-schema-validation",
        method: "GET",
        endpoint: "/complex",
        expectedStatusCodes: [200],
        schema: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                id: { type: "number" },
                email: { type: "string", format: "email" },
                age: { type: "number", minimum: 0 }
              },
              required: ["id", "email", "age"]
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" }
                },
                required: ["name"]
              }
            }
          },
          required: ["user", "items"]
        },
        testKey: "T-28",
      } as any,
      ACCESS_TOKEN,
      VERSION as any
    );

    expect(res.status).toBe(TestCaseResultStatus.FAILURE);
    expect(res.errorMessage).toContain("Schema validation failed:");
    expect(res.apiResponse).toBe(JSON.stringify(complexInvalidData));
  });
});
