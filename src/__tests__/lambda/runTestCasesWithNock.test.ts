// Mock environment variable before importing the adapter as it reads the variable during import
process.env.DYNAMODB_TABLE_NAME = "test-table";

import { handler } from "../../lambda/runTestCases";
import { APIGatewayProxyEvent } from "aws-lambda";
import nock from "nock";
import * as dbUtils from "../../utils/dbUtils";
import { mockFootprints, mockFootprintsV3 } from "../mocks/footprints";

// Mock the environment variables
process.env.WEBHOOK_URL = "https://webhook.test.url";

// Mock the UUID generation to get consistent test IDs
jest.mock("crypto", () => ({
  randomUUID: jest.fn().mockReturnValue("test-uuid-1234"),
}));

// Mock the DB utils
jest.mock("../../utils/dbUtils");

interface TestResult {
  success: boolean;
  mandatory: boolean;
  testKey?: string;
}

describe("runTestCases Lambda handler with nock", () => {
  const mockBaseUrl = "https://api.example.com";
  const mockHttpBaseUrl = "http://api.example.com";
  const mockAuthBaseUrl = "https://auth.example.com";
  const mockHttpAuthBaseUrl = "http://auth.example.com";
  const mockTokenEndpoint = "/auth/token";
  const mockClientId = "test-client-id";
  const mockClientSecret = "test-client-secret";
  const mockAccessToken = "mock-access-token-12345";

  // Prepare the APIGatewayProxyEvent mock
  const createEvent = (body: any): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      headers: {},
      multiValueHeaders: {},
      httpMethod: "POST",
      isBase64Encoded: false,
      path: "/test",
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: "",
    };
  };

  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();

    // Mock DB utility functions
    (dbUtils.saveTestRun as jest.Mock).mockResolvedValue(undefined);
    (dbUtils.saveTestData as jest.Mock).mockResolvedValue(undefined);
    (dbUtils.saveTestCaseResults as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  // Block all external network connections
  nock.disableNetConnect();

  test("should execute test cases with real HTTP mocks and return success when all tests pass for V2", async () => {
    // Helper function to persist nock definitions across multiple test cases
    const persistentNock = (baseUrl: string) => {
      return nock(baseUrl).persist();
    };

    // IMPORTANT: Define the invalid token mocks first to ensure they have higher precedence

    // Mock for Test Case 6: Invalid token for ListFootprints
    nock(mockBaseUrl)
      .get("/2/footprints")
      .matchHeader("authorization", (value: string): boolean => {
        return Boolean(
          value &&
            typeof value === "string" &&
            value.includes("very-invalid-access-token")
        );
      })
      .reply(400, { code: "BadRequest", message: "Invalid token" })
      .persist();

    // Mock for Test Case 7: Invalid token for GetFootprint
    nock(mockBaseUrl)
      .get(
        /\/2\/footprints\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      )
      .matchHeader("authorization", (value: string): boolean => {
        return Boolean(
          value &&
            typeof value === "string" &&
            value.includes("very-invalid-access-token")
        );
      })
      .reply(400, { code: "BadRequest", message: "Invalid token" })
      .persist();

    // Mock for Test Case 14: Invalid token for Events
    nock(mockBaseUrl)
      .post("/2/events")
      .matchHeader("authorization", (value: string): boolean => {
        return Boolean(
          value &&
            typeof value === "string" &&
            value.includes("very-invalid-access-token")
        );
      })
      .reply(400, { code: "BadRequest", message: "Invalid token" })
      .persist();

    // Mock the OpenID auth URL discovery endpoint
    persistentNock(mockAuthBaseUrl)
      .get("/.well-known/openid-configuration")
      .reply(200, {
        token_endpoint: `${mockAuthBaseUrl}${mockTokenEndpoint}`,
      });

    // Special handling for Test Case 18: OpenId connect with incorrect credentials
    // This needs to be defined before the valid credentials case
    nock(mockAuthBaseUrl)
      .post(mockTokenEndpoint)
      .matchHeader("authorization", (value) => {
        if (!value || typeof value !== "string") return false;

        // Extract and decode the base64 part
        const match = value.match(/^Basic\s+(.+)$/);
        if (!match) return false;

        const decoded = Buffer.from(match[1], "base64").toString();

        // Check if this is NOT our valid test credentials
        return decoded !== `${mockClientId}:${mockClientSecret}`;
      })
      .reply(400, {
        error: "invalid_client",
        error_description: "Invalid client credentials",
      })
      .persist();

    // More flexible auth token mock for valid credentials - respond to any request with valid credentials
    persistentNock(mockAuthBaseUrl)
      .post(mockTokenEndpoint)
      .matchHeader("authorization", (value) => {
        if (!value || typeof value !== "string") return false;

        const match = value.match(/^Basic\s+(.+)$/);
        if (!match) return false;

        const decoded = Buffer.from(match[1], "base64").toString();

        // Check if this IS our valid test credentials
        return decoded === `${mockClientId}:${mockClientSecret}`;
      })
      .reply(200, {
        access_token: mockAccessToken,
        token_type: "Bearer",
        expires_in: 3600,
      });

    // Mock for Test Case 3: GetFootprint
    persistentNock(mockBaseUrl)
      .get("/2/footprints/123e4567-e89b-12d3-a456-426614174000")
      .reply(200, { data: mockFootprints.data[0] });

    // Mock for Test Case 4: ListFootprints
    persistentNock(mockBaseUrl).get("/2/footprints").reply(200, mockFootprints);

    // Mock for Test Case 5: Pagination with limit parameter
    persistentNock(mockBaseUrl)
      .get("/2/footprints?limit=1")
      .reply(200, mockFootprints, {
        Link: `<${mockBaseUrl}/2/footprints?offset=2&limit=1>; rel="next"`,
      });

    // Mock for Test Case 5: Pagination
    persistentNock(mockBaseUrl)
      .get("/2/footprints?offset=2&limit=1")
      .reply(200, mockFootprints);

    // Mock for Test Case 8: Non-existent footprint
    persistentNock(mockBaseUrl)
      .get(/\/2\/footprints\/random-string-as-id/)
      .reply(404, { code: "NoSuchFootprint", message: "Footprint not found" });

    // Mock for Test Case 12 & 16: Events
    persistentNock(mockBaseUrl).post("/2/events").reply(200);

    // Mock for Test Case 19: Filtered list
    persistentNock(mockBaseUrl)
      .get(/\/2\/footprints\?\$filter=/)
      .reply(200, mockFootprints);

    // Non https mocks
    persistentNock(mockHttpBaseUrl)
      .get("/2/footprints")
      .reply(403, { code: "AccessDenied" });

    persistentNock(mockHttpBaseUrl)
      .get("/2/footprints/123e4567-e89b-12d3-a456-426614174000")
      .reply(403, { code: "AccessDenied" });

    persistentNock(mockHttpBaseUrl)
      .post("/2/events")
      .reply(403, { code: "AccessDenied" });

    persistentNock(mockHttpAuthBaseUrl)
      .post("/auth/token")
      .reply(403, { code: "AccessDenied" });

    // Mock the test cases in runTestCases
    const event = createEvent({
      baseUrl: mockBaseUrl,
      clientId: mockClientId,
      clientSecret: mockClientSecret,
      version: "V2.3",
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
      customAuthBaseUrl: mockAuthBaseUrl,
    });

    // Run the lambda handler
    const result = await handler(event);

    // We'll consider the test passing if the lambda handler returns without throwing
    expect(result.statusCode).toBeDefined();

    expect(
      JSON.parse(result.body).results.filter(
        (r: TestResult) => r.success === false
      )
    ).toHaveLength(2); // Async tests should be pending

    expect(
      JSON.parse(result.body).results.find(
        (r: TestResult) => r.success === false && r.mandatory
      )
    ).toHaveProperty("testKey", "TESTCASE#13");

    // All mocks should have been called
    expect(nock.isDone()).toBe(true);
  });

  test("should execute test cases with real HTTP mocks and return success when all tests pass for V3", async () => {
    // Helper function to persist nock definitions across multiple test cases
    const persistentNock = (baseUrl: string) => {
      return nock(baseUrl).persist();
    };

    // IMPORTANT: Define the invalid token mocks first to ensure they have higher precedence

    // Mock for Test Case 6: Invalid token for ListFootprints
    nock(mockBaseUrl)
      .get("/3/footprints")
      .matchHeader("authorization", (value: string): boolean => {
        return Boolean(
          value &&
            typeof value === "string" &&
            value.includes("very-invalid-access-token")
        );
      })
      .reply(400, { code: "BadRequest", message: "Invalid token" })
      .persist();

    // Mock for Test Case 7: Invalid token for GetFootprint
    nock(mockBaseUrl)
      .get(
        /\/3\/footprints\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
      )
      .matchHeader("authorization", (value: string): boolean => {
        return Boolean(
          value &&
            typeof value === "string" &&
            value.includes("very-invalid-access-token")
        );
      })
      .reply(400, { code: "BadRequest", message: "Invalid token" })
      .persist();

    // Mock for Test Case 14: Invalid token for Events
    nock(mockBaseUrl)
      .post("/3/events")
      .matchHeader("authorization", (value: string): boolean => {
        return Boolean(
          value &&
            typeof value === "string" &&
            value.includes("very-invalid-access-token")
        );
      })
      .reply(400, { code: "BadRequest", message: "Invalid token" })
      .persist();

    // Mock the OpenID auth URL discovery endpoint
    persistentNock(mockAuthBaseUrl)
      .get("/.well-known/openid-configuration")
      .reply(200, {
        token_endpoint: `${mockAuthBaseUrl}${mockTokenEndpoint}`,
      });

    // Special handling for Test Case 18: OpenId connect with incorrect credentials
    // This needs to be defined before the valid credentials case
    nock(mockAuthBaseUrl)
      .post(mockTokenEndpoint)
      .matchHeader("authorization", (value) => {
        if (!value || typeof value !== "string") return false;

        // Extract and decode the base64 part
        const match = value.match(/^Basic\s+(.+)$/);
        if (!match) return false;

        const decoded = Buffer.from(match[1], "base64").toString();

        // Check if this is NOT our valid test credentials
        return decoded !== `${mockClientId}:${mockClientSecret}`;
      })
      .reply(400, {
        error: "invalid_client",
        error_description: "Invalid client credentials",
      })
      .persist();

    // More flexible auth token mock for valid credentials - respond to any request with valid credentials
    persistentNock(mockAuthBaseUrl)
      .post(mockTokenEndpoint)
      .matchHeader("authorization", (value) => {
        if (!value || typeof value !== "string") return false;

        const match = value.match(/^Basic\s+(.+)$/);
        if (!match) return false;

        const decoded = Buffer.from(match[1], "base64").toString();

        // Check if this IS our valid test credentials
        return decoded === `${mockClientId}:${mockClientSecret}`;
      })
      .reply(200, {
        access_token: mockAccessToken,
        token_type: "Bearer",
        expires_in: 3600,
      });

    // Mock for Test Case 3: GetFootprint
    persistentNock(mockBaseUrl)
      .get("/3/footprints/12345678-9abc-def0-1234-567812345678")
      .reply(200, { data: mockFootprintsV3.data[0] });

    // Mock for Test Case 4: ListFootprints
    persistentNock(mockBaseUrl)
      .get("/3/footprints")
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 5: Pagination with limit parameter
    persistentNock(mockBaseUrl)
      .get("/3/footprints?limit=1")
      .reply(200, mockFootprintsV3, {
        Link: `<${mockBaseUrl}/3/footprints?offset=2&limit=1>; rel="next"`,
      });

    // Mock for Test Case 5: Pagination
    persistentNock(mockBaseUrl)
      .get("/3/footprints?offset=2&limit=1")
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 8: Non-existent footprint
    persistentNock(mockBaseUrl)
      .get(/\/3\/footprints\/random-string-as-id/)
      .reply(404, { code: "NotFound", message: "Footprint not found" });

    // Mock for Test Case 12 & 16: Events
    persistentNock(mockBaseUrl).post("/3/events").reply(200);

    // Mock for V3-specific test cases
    // Mock for Test Case 19: Filtered List of Footprints by productId
    persistentNock(mockBaseUrl)
      .get("/3/footprints?productId=urn:gtin:5695872369587")
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 20: Filtered List of Footprints by companyId
    persistentNock(mockBaseUrl)
      .get("/3/footprints?companyId=urn:company:example:company1")
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 21: Filtered List of Footprints by geography
    persistentNock(mockBaseUrl)
      .get("/3/footprints?geography=US")
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 22: Filtered List of Footprints by classification
    persistentNock(mockBaseUrl)
      .get(
        "/3/footprints?classification=urn:pact:productclassification:cas:1456"
      )
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 23: Filtered List of Footprints by validOn
    persistentNock(mockBaseUrl)
      .get("/3/footprints?validOn=2024-12-31T00:00:00Z")
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 24: Filtered List of Footprints by validAfter
    persistentNock(mockBaseUrl)
      .get("/3/footprints?validAfter=2024-12-30T00:00:00.000Z")
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 25: Filtered List of Footprints by validBefore
    persistentNock(mockBaseUrl)
      .get("/3/footprints?validBefore=2028-01-01T00:00:00.000Z")
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 26: Filtered List of Footprints by status
    persistentNock(mockBaseUrl)
      .get("/3/footprints?status=Active")
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 27: Filtered List of Footprints by both status and productId
    persistentNock(mockBaseUrl)
      .get("/3/footprints?status=Active&productId=urn:gtin:5695872369587")
      .reply(200, mockFootprintsV3);

    // Mock for Test Case 29: Filtered List of Footprints by multiple status values (OR logic)
    persistentNock(mockBaseUrl)
      .get(
        new RegExp(
          `^/3/footprints\\?companyId=${mockFootprintsV3.data[0].companyIds[0]}&companyId=[^&]+&companyId=[^&]+$`
        )
      )
      .reply(200, mockFootprintsV3);

    // Non https mocks
    persistentNock(mockHttpBaseUrl)
      .get("/3/footprints")
      .reply(403, { code: "AccessDenied" });

    persistentNock(mockHttpBaseUrl)
      .get("/3/footprints/12345678-9abc-def0-1234-567812345678")
      .reply(403, { code: "AccessDenied" });

    persistentNock(mockHttpBaseUrl)
      .post("/3/events")
      .reply(403, { code: "AccessDenied" });

    persistentNock(mockHttpAuthBaseUrl)
      .post("/auth/token")
      .reply(403, { code: "AccessDenied" });

    // Mock the test cases in runTestCases
    const event = createEvent({
      baseUrl: mockBaseUrl,
      clientId: mockClientId,
      clientSecret: mockClientSecret,
      version: "V3.0",
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
      customAuthBaseUrl: mockAuthBaseUrl,
    });

    // Run the lambda handler
    const result = await handler(event);

    // We'll consider the test passing if the lambda handler returns without throwing
    expect(result.statusCode).toBeDefined();

    expect(
      JSON.parse(result.body).results.filter(
        (r: TestResult) => r.success === false
      )
    ).toHaveLength(2); // Async tests should be pending
    expect(
      JSON.parse(result.body).results.find(
        (r: TestResult) => r.success === false && r.mandatory
      )
    ).toHaveProperty("testKey", "TESTCASE#13");

    // All mocks should have been called
    expect(nock.isDone()).toBe(true);
  });
});
