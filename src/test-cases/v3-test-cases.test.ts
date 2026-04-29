/**
 * Tests for V3.x test cases. 
 * Tests are written to verify the declarative implementation (v3-test-cases.ts + runTestCase).
 *
 * Listener tests (TC13, TC14.B) are tested separately.
 */

import { jest } from "@jest/globals";
import { TestCaseResultStatus, EventTypesV3, ApiVersion } from "../services/types";
import { generateV3TestCases } from "./v3-test-cases";
import { runTestCase } from "../utils/runTestCase";
import { getSchema } from "../schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_URL = "https://example.com";
const AUTH_URL = "https://example.com/auth/token";
const WEBHOOK_URL = "https://example.com/webhook";
const CLIENT_ID = "test-client";
const CLIENT_SECRET = "test-secret";
const ACCESS_TOKEN = "test-access-token";
const TEST_RUN_ID = "test-run-id";
const VERSION: ApiVersion = "V3.0";

const MOCK_FOOTPRINT = {
  id: "00000000-0000-0000-0000-000000000000",
  productIds: ["urn:x:product:1"],
  companyIds: ["urn:x:company:1"],
  pcf: {
    geographyCountry: "DE",
    referencePeriodEnd: "2024-01-01T00:00:00Z",
  },
  productClassifications: ["urn:x:classification:1"],
  validityPeriodStart: "2023-01-01T00:00:00Z",
  validityPeriodEnd: "2026-01-01T00:00:00Z",
  status: "Active",
};

const MOCK_FOOTPRINTS = { data: [MOCK_FOOTPRINT] };

const PAGINATION_LINKS: Record<string, string> = {
  next: `${BASE_URL}/3/footprints?offset=1`,
};

const AUTH_REQUEST_DATA = "grant_type=client_credentials";

// ---------------------------------------------------------------------------
// Valid response bodies for each shape
// ---------------------------------------------------------------------------

const validAuthBody = JSON.stringify({ access_token: "tok" });
const validEmptyBody = JSON.stringify({ data: [] });
const validSimpleListBody = JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, productIds: ["urn:x:product:1"] }] });

// Minimal valid ProductFootprint (satisfies the v3.0 OpenAPI schema)
// Note: decimal fields are type: string in the v3.0 schema; unit enum requires full names
const VALID_PRODUCT_FOOTPRINT = {
  id: "079e425a-464f-528d-341d-4a944a1dfd70", // valid UUID v4 format
  specVersion: "3.0.0", // must match /^\d+\.\d+\.\d+(-\d{8})?$/
  status: "Active",
  created: "2024-01-01T00:00:00Z",
  companyName: "Test Company",
  companyIds: ["urn:x:company:1"],
  productDescription: "Test product",
  productIds: ["urn:x:product:1"],
  productNameCompany: "Test Product Name",
  pcf: {
    declaredUnitOfMeasurement: "kilogram",
    declaredUnitAmount: "1.0",
    productMassPerDeclaredUnit: "1.0",
    referencePeriodStart: "2023-01-01T00:00:00Z",
    referencePeriodEnd: "2024-01-01T00:00:00Z",
    geographyCountry: "DE",
    pcfExcludingBiogenicUptake: "1.0",
    pcfIncludingBiogenicUptake: "1.0",
    fossilGhgEmissions: "1.0",
    fossilCarbonContent: "0.0",
    ipccCharacterizationFactors: ["AR5"],
    crossSectoralStandards: ["GHG Protocol Product standard"],
    exemptedEmissionsPercent: "0",
    exemptedEmissionsDescription: "none",
  },
};

const validSingleFootprintBody = JSON.stringify({ data: { ...VALID_PRODUCT_FOOTPRINT, id: MOCK_FOOTPRINT.id } });
const validListBody = JSON.stringify({ data: [{ ...VALID_PRODUCT_FOOTPRINT, id: MOCK_FOOTPRINT.id }] });
const invalidListBody = JSON.stringify({ data: [{ ...VALID_PRODUCT_FOOTPRINT, id: "invalid", productIds: [] }] });

// A valid fulfilled event (TC13) — pfs must contain valid ProductFootprint objects
const validFulfilledEventBody = JSON.stringify({
  specversion: "1.0",
  id: `${TEST_RUN_ID}/13`,
  source: WEBHOOK_URL,
  time: new Date().toISOString(),
  type: EventTypesV3.FULFILLED,
  data: {
    requestEventId: `${TEST_RUN_ID}/12`,
    pfs: [{ ...VALID_PRODUCT_FOOTPRINT, productIds: ["urn:x:product:1"] }],
  },
});

// A valid rejected event (TC14.B)
const validRejectedEventBody = JSON.stringify({
  specversion: "1.0",
  id: `${TEST_RUN_ID}/14.B`,
  source: BASE_URL,
  time: new Date().toISOString(),
  type: EventTypesV3.REJECTED,
  data: {
    requestEventId: `${TEST_RUN_ID}/14.A`,
    error: { code: "BadRequest", message: "Rejected" },
  },
});

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

type MockFetchEntry =
  | { status: number; body: string; contentType?: string }
  | { throws: Error };

function mockFetch(...responses: MockFetchEntry[]) {
  let i = 0;
  global.fetch = jest.fn().mockImplementation(() => {
    const r = responses[Math.min(i++, responses.length - 1)];
    if ("throws" in r) return Promise.reject(r.throws);
    const contentType = r.contentType ?? "application/json";
    return Promise.resolve({
      status: r.status,
      text: () => Promise.resolve(r.body),
      headers: { get: (h: string) => (h === "Content-Type" ? contentType : null) },
    });
  }) as any;
}

function mockFetchNetworkError() {
  mockFetch({ throws: new TypeError("fetch failed: ECONNREFUSED") });
}

// ---------------------------------------------------------------------------
// Runner abstraction
// ---------------------------------------------------------------------------

interface EquivalenceTestContext {
  runner: (testKey: string) => Promise<{ status: TestCaseResultStatus; errorMessage?: string }>;
}

// Built once before tests run
let declarativeCtx: EquivalenceTestContext;

beforeAll(async () => {
  const schema = await getSchema(VERSION);

  // --- Declarative runner ---
  const testCases = await generateV3TestCases({
    testRunId: TEST_RUN_ID,
    footprints: MOCK_FOOTPRINTS,
    paginationLinks: PAGINATION_LINKS,
    baseUrl: BASE_URL,
    authTokenUrl: AUTH_URL,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    authRequestData: AUTH_REQUEST_DATA,
    version: VERSION,
    webhookUrl: WEBHOOK_URL,
  });

  declarativeCtx = {
    runner: async (testKey: string) => {
      const tc = testCases.find((t) => t.testKey === testKey);
      if (!tc) throw new Error(`Test case ${testKey} not found in declarative set`);
      return runTestCase(BASE_URL, tc, ACCESS_TOKEN, VERSION);
    },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

{
  let testcontext: EquivalenceTestContext;
  beforeAll(() => { testcontext = declarativeCtx; });

  // -------------------------------------------------------------------------
  describe("TC1: Obtain auth token with valid credentials", () => {
    it("succeeds on HTTP 200", async () => {
      mockFetch({ status: 200, body: validAuthBody });
      const result = await testcontext.runner("TESTCASE#1");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 401", async () => {
      mockFetch({ status: 401, body: '{}' });
      const result = await testcontext.runner("TESTCASE#1");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC2: Obtain auth token with invalid credentials", () => {
    it("succeeds on HTTP 400", async () => {
      mockFetch({ status: 400, body: '{}' });
      const result = await testcontext.runner("TESTCASE#2");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("succeeds on HTTP 401", async () => {
      mockFetch({ status: 401, body: '{}' });
      const result = await testcontext.runner("TESTCASE#2");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 200", async () => {
      mockFetch({ status: 200, body: validAuthBody });
      const result = await testcontext.runner("TESTCASE#2");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC3: Get PCF using GetFootprint", () => {
    it("succeeds on HTTP 200 with matching id", async () => {
      mockFetch({ status: 200, body: validSingleFootprintBody });
      const result = await testcontext.runner("TESTCASE#3");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when returned id does not match", async () => {
      // Use a valid UUID (different from MOCK_FOOTPRINT.id) so schema passes and the id-mismatch condition is what causes failure
      mockFetch({ status: 200, body: JSON.stringify({ data: { ...VALID_PRODUCT_FOOTPRINT, id: "11111111-0000-0000-0000-000000000000" } }) });
      const result = await testcontext.runner("TESTCASE#3");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
    it("fails on HTTP 404", async () => {
      mockFetch({ status: 404, body: '{}' });
      const result = await testcontext.runner("TESTCASE#3");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC4: Get all PCFs using ListFootprints", () => {
    it("succeeds on HTTP 200 with non-empty footprint list", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#4");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("succeeds on HTTP 202 with non-empty footprint list", async () => {
      mockFetch({ status: 202, body: validListBody });
      const result = await testcontext.runner("TESTCASE#4");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it ("fails on HTTP 200 with invalid footprint list", async () => {    
        mockFetch({ status: 200, body: invalidListBody });
        const result = await testcontext.runner("TESTCASE#4");
        expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
    it("fails when footprint list is empty", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [] }) });
      const result = await testcontext.runner("TESTCASE#4");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
    it("fails on HTTP 404", async () => {
      mockFetch({ status: 404, body: '{}' });
      const result = await testcontext.runner("TESTCASE#4");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC5: Pagination link implementation", () => {
    it("succeeds on HTTP 200 with valid body", async () => {
      mockFetch({ status: 200, body: validSimpleListBody });
      const result = await testcontext.runner("TESTCASE#5");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response data array is empty", async () => {
      // simpleListFootprintResponse requires minItems: 1
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#5");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
    it("fails on HTTP 404", async () => {
      mockFetch({ status: 404, body: '{}' });
      const result = await testcontext.runner("TESTCASE#5");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC6: ListFootprints with invalid token", () => {
    it("succeeds on HTTP 401", async () => {
      mockFetch({ status: 401, body: '{"code":"BadRequest"}' });
      const result = await testcontext.runner("TESTCASE#6");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("succeeds on HTTP 400", async () => {
      mockFetch({ status: 400, body: '{"code":"BadRequest"}' });
      const result = await testcontext.runner("TESTCASE#6");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 200", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#6");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC7: GetFootprint with invalid token", () => {
    it("succeeds on HTTP 401", async () => {
      mockFetch({ status: 401, body: '{"code":"BadRequest"}' });
      const result = await testcontext.runner("TESTCASE#7");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("succeeds on HTTP 400", async () => {
      mockFetch({ status: 400, body: '{"code":"BadRequest"}' });
      const result = await testcontext.runner("TESTCASE#7");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 200", async () => {
      mockFetch({ status: 200, body: validSingleFootprintBody });
      const result = await testcontext.runner("TESTCASE#7");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC8: GetFootprint with non-existent pfId", () => {
    it("succeeds on HTTP 404 with NotFound code", async () => {
      mockFetch({ status: 404, body: '{"code":"NotFound"}' });
      const result = await testcontext.runner("TESTCASE#8");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    // TODO: Add an extra test (8A) getting a footprint with an invalid id format 
    // (e.g. not a UUID). This should also succeed with a 400 + BadRequest response.
    //
    // it("succeeds on HTTP 400 with BadRequest code", async () => {
    //   mockFetch({ status: 400, body: '{"code":"BadRequest"}' });
    //   const result = await testcontext.runner("TESTCASE#8");
    //   expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    // });
    it("fails on HTTP 200", async () => {
      mockFetch({ status: 200, body: validSingleFootprintBody });
      const result = await testcontext.runner("TESTCASE#8");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
    it("fails on HTTP 404 with wrong error code", async () => {
      mockFetch({ status: 404, body: '{"code":"SomethingElse"}' });
      const result = await testcontext.runner("TESTCASE#8");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC9: Authentication through HTTP (non-HTTPS)", () => {
    it("succeeds when fetch throws a network error (HTTP refused)", async () => {
      mockFetchNetworkError();
      const result = await testcontext.runner("TESTCASE#9");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when auth request unexpectedly succeeds over HTTP", async () => {
      mockFetch({ status: 200, body: validAuthBody });
      const result = await testcontext.runner("TESTCASE#9");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC10: ListFootprints through HTTP (non-HTTPS)", () => {
    it("succeeds when fetch throws a network error", async () => {
      mockFetchNetworkError();
      const result = await testcontext.runner("TESTCASE#10");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    // TC10 "fails" scenario: when a schema-valid list response is returned over HTTP,
    // both implementations should report FAILURE (the HTTP connection should have been refused).
    it("fails when request unexpectedly succeeds over HTTP with valid body", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#10");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC11: GetFootprint through HTTP (non-HTTPS)", () => {
    it("succeeds when fetch throws a network error", async () => {
      mockFetchNetworkError();
      const result = await testcontext.runner("TESTCASE#11");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    // TC11 "fails" scenario: when a schema-valid footprint response is returned over HTTP,
    // both implementations should report FAILURE (the HTTP connection should have been refused).
    it("fails when request unexpectedly succeeds over HTTP with valid body", async () => {
      mockFetch({ status: 200, body: validSingleFootprintBody });
      const result = await testcontext.runner("TESTCASE#11");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC12: Send Asynchronous PCF Request", () => {
    it("succeeds on HTTP 200", async () => {
      mockFetch({ status: 200, body: '{}' });
      const result = await testcontext.runner("TESTCASE#12");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 400", async () => {
      mockFetch({ status: 400, body: '{}' });
      const result = await testcontext.runner("TESTCASE#12");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // TC13 and TC14.B are listener tests — see dedicated section below

  // -------------------------------------------------------------------------
  describe("TC14.A: Send Asynchronous Request to be Rejected", () => {
    const testKey14A = "TESTCASE#14.A";
    it("succeeds on HTTP 200", async () => {
      mockFetch({ status: 200, body: '{}' });
      const key = testKey14A;
      const result = await testcontext.runner(key);
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 400", async () => {
      mockFetch({ status: 400, body: '{}' });
      const key = testKey14A;
      const result = await testcontext.runner(key);
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC15: Receive Notification of PCF Update", () => {
    it("succeeds on HTTP 200", async () => {
      mockFetch({ status: 200, body: '{}' });
      const result = await testcontext.runner("TESTCASE#15");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 400", async () => {
      mockFetch({ status: 400, body: '{}' });
      const result = await testcontext.runner("TESTCASE#15");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC16: Action Events with invalid token", () => {
    it("succeeds on HTTP 401", async () => {
      mockFetch({ status: 401, body: '{"code":"BadRequest"}' });
      const result = await testcontext.runner("TESTCASE#16");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("succeeds on HTTP 400", async () => {
      mockFetch({ status: 400, body: '{"code":"BadRequest"}' });
      const result = await testcontext.runner("TESTCASE#16");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 200", async () => {
      mockFetch({ status: 200, body: '{}' });
      const result = await testcontext.runner("TESTCASE#16");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC17: Action Events through HTTP (non-HTTPS)", () => {
    it("succeeds when fetch throws a network error", async () => {
      mockFetchNetworkError();
      const result = await testcontext.runner("TESTCASE#17");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when request unexpectedly succeeds over HTTP", async () => {
      mockFetch({ status: 200, body: '{}' });
      const result = await testcontext.runner("TESTCASE#17");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC18: OpenId Connect-based Authentication Flow", () => {
    it("succeeds on HTTP 200", async () => {
      mockFetch({ status: 200, body: validAuthBody });
      const result = await testcontext.runner("TESTCASE#18");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 401", async () => {
      mockFetch({ status: 401, body: '{}' });
      const result = await testcontext.runner("TESTCASE#18");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC19: OpenId Connect authentication with incorrect credentials", () => {
    it("succeeds on HTTP 400", async () => {
      mockFetch({ status: 400, body: '{}' });
      const result = await testcontext.runner("TESTCASE#19");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("succeeds on HTTP 401", async () => {
      mockFetch({ status: 401, body: '{}' });
      const result = await testcontext.runner("TESTCASE#19");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 200", async () => {
      mockFetch({ status: 200, body: validAuthBody });
      const result = await testcontext.runner("TESTCASE#19");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC20: Filter by productId", () => {
    it("succeeds when all returned footprints include the productId", async () => {
      // Body must include productIds field (used by both implementations' condition check)
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, productIds: ["urn:x:product:1"] }] }) });
      const result = await testcontext.runner("TESTCASE#20");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when a footprint does not include the productId", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, productIds: ["urn:other"] }] }) });
      const result = await testcontext.runner("TESTCASE#20");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC21: Filter by companyId", () => {
    it("succeeds when all returned footprints include the companyId", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, companyIds: ["urn:x:company:1"] }] }) });
      const result = await testcontext.runner("TESTCASE#21");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when a footprint does not include the companyId", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, companyIds: ["urn:other"] }] }) });
      const result = await testcontext.runner("TESTCASE#21");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC22: Filter by geography", () => {
    it("succeeds when all footprints match geography", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, pcf: { geographyCountry: "DE" } }] }) });
      const result = await testcontext.runner("TESTCASE#22");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when a footprint does not match geography", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, pcf: { geographyCountry: "FR" } }] }) });
      const result = await testcontext.runner("TESTCASE#22");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC23: Filter by classification", () => {
    it("succeeds when all footprints include the classification", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, productClassifications: ["urn:x:classification:1"] }] }) });
      const result = await testcontext.runner("TESTCASE#23");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when a footprint does not include the classification", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, productClassifications: ["urn:other"] }] }) });
      const result = await testcontext.runner("TESTCASE#23");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC24: Filter by validOn", () => {
    it("succeeds when footprint validity period contains validOn", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, validityPeriodStart: "2022-01-01T00:00:00Z", validityPeriodEnd: "2027-01-01T00:00:00Z", pcf: {} }] }) });
      const result = await testcontext.runner("TESTCASE#24");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("succeeds using referencePeriodEnd fallback when validityPeriod is absent", async () => {
      // validOn = "2023-01-01", referencePeriodEnd = "2022-01-01", +3yrs = "2025-01-01"
      // condition: refEnd (2022) <= validOn (2023) <= refEnd+3yrs (2025) ✓
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, pcf: { referencePeriodEnd: "2022-01-01T00:00:00Z" } }] }) });
      const result = await testcontext.runner("TESTCASE#24");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when footprint validity period does not contain validOn", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, validityPeriodStart: "2024-06-01T00:00:00Z", validityPeriodEnd: "2025-01-01T00:00:00Z", pcf: {} }] }) });
      const result = await testcontext.runner("TESTCASE#24");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
    it("fails using referencePeriodEnd fallback when validOn is outside the reference period", async () => {
      // validOn = "2023-01-01", referencePeriodEnd = "2019-01-01", +3yrs = "2022-01-01" < validOn ✗
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, pcf: { referencePeriodEnd: "2019-01-01T00:00:00Z" } }] }) });
      const result = await testcontext.runner("TESTCASE#24");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC25: Filter by validAfter", () => {
    it("succeeds when footprint validityPeriodStart is after validAfter", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, validityPeriodStart: "2023-06-01T00:00:00Z", pcf: {} }] }) });
      const result = await testcontext.runner("TESTCASE#25");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("succeeds using referencePeriodEnd fallback when validityPeriodStart is absent", async () => {
      // validAfter = "2022-12-31", referencePeriodEnd = "2023-06-01" > validAfter ✓
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, pcf: { referencePeriodEnd: "2023-06-01T00:00:00Z" } }] }) });
      const result = await testcontext.runner("TESTCASE#25");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when footprint validityPeriodStart is before validAfter", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, validityPeriodStart: "2020-01-01T00:00:00Z", pcf: {} }] }) });
      const result = await testcontext.runner("TESTCASE#25");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
    it("fails using referencePeriodEnd fallback when referencePeriodEnd is before validAfter", async () => {
      // validAfter = "2022-12-31", referencePeriodEnd = "2021-01-01" < validAfter ✗
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, pcf: { referencePeriodEnd: "2021-01-01T00:00:00Z" } }] }) });
      const result = await testcontext.runner("TESTCASE#25");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC26: Filter by validBefore", () => {
    it("succeeds when footprint validityPeriodEnd is before validBefore", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, validityPeriodEnd: "2025-01-01T00:00:00Z", pcf: {} }] }) });
      const result = await testcontext.runner("TESTCASE#26");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("succeeds using referencePeriodEnd fallback when validityPeriodEnd is absent", async () => {
      // validBefore = "2026-01-02", referencePeriodEnd = "2022-01-01", +3yrs = "2025-01-01" < validBefore ✓
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, pcf: { referencePeriodEnd: "2022-01-01T00:00:00Z" } }] }) });
      const result = await testcontext.runner("TESTCASE#26");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when footprint validityPeriodEnd is after validBefore", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, validityPeriodEnd: "2027-01-01T00:00:00Z", pcf: {} }] }) });
      const result = await testcontext.runner("TESTCASE#26");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
    it("fails using referencePeriodEnd fallback when referencePeriodEnd+3yrs exceeds validBefore", async () => {
      // validBefore = "2026-01-02", referencePeriodEnd = "2024-01-01", +3yrs = "2027-01-01" > validBefore ✗
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, pcf: { referencePeriodEnd: "2024-01-01T00:00:00Z" } }] }) });
      const result = await testcontext.runner("TESTCASE#26");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC27: Filter by status", () => {
    it("succeeds when all footprints have matching status", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, status: "Active" }] }) });
      const result = await testcontext.runner("TESTCASE#27");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when a footprint has a different status", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, status: "Inactive" }] }) });
      const result = await testcontext.runner("TESTCASE#27");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC28: Filter by status AND productId", () => {
    it("succeeds when all footprints match both filters", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, status: "Active", productIds: ["urn:x:product:1"] }] }) });
      const result = await testcontext.runner("TESTCASE#28");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when status matches but productId does not", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, status: "Active", productIds: ["urn:other"] }] }) });
      const result = await testcontext.runner("TESTCASE#28");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC29: Filter by multiple companyIds (OR logic)", () => {
    it("succeeds when all footprints include the known companyId", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, companyIds: ["urn:x:company:1"] }] }) });
      const result = await testcontext.runner("TESTCASE#29");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when a footprint does not include the known companyId", async () => {
      mockFetch({ status: 200, body: JSON.stringify({ data: [{ id: MOCK_FOOTPRINT.id, companyIds: ["urn:other"] }] }) });
      const result = await testcontext.runner("TESTCASE#29");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC30: Filter by productId (negative)", () => {
    it("succeeds when response contains empty data array", async () => {
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#30");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response contains footprints", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#30");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC31: Filter by companyId (negative)", () => {
    it("succeeds when response contains empty data array", async () => {
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#31");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response contains footprints", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#31");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC32: Filter by geography (negative)", () => {
    it("succeeds when response contains empty data array", async () => {
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#32");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response contains footprints", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#32");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC33: Filter by classification (negative)", () => {
    it("succeeds when response contains empty data array", async () => {
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#33");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response contains footprints", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#33");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC34: Filter by validOn (negative)", () => {
    it("succeeds when response contains empty data array", async () => {
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#34");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response contains footprints", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#34");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC35: Filter by validAfter (negative)", () => {
    it("succeeds when response contains empty data array", async () => {
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#35");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response contains footprints", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#35");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC36: Filter by validBefore (negative)", () => {
    it("succeeds when response contains empty data array", async () => {
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#36");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response contains footprints", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#36");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC37: Filter by status (negative)", () => {
    it("succeeds when response contains empty data array", async () => {
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#37");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response contains footprints", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#37");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC38: Filter by multiple params AND logic (negative)", () => {
    it("succeeds when response contains empty data array", async () => {
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#38");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response contains footprints", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#38");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC39: Filter by multiple companyIds OR logic (negative)", () => {
    it("succeeds when response contains empty data array", async () => {
      mockFetch({ status: 200, body: validEmptyBody });
      const result = await testcontext.runner("TESTCASE#39");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails when response contains footprints", async () => {
      mockFetch({ status: 200, body: validListBody });
      const result = await testcontext.runner("TESTCASE#39");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });

  // -------------------------------------------------------------------------
  describe("TC40: Failed Published Event - Malformed Request", () => {
    it("succeeds on HTTP 400", async () => {
      mockFetch({ status: 400, body: '{}' });
      const result = await testcontext.runner("TESTCASE#40");
      expect(result.status).toBe(TestCaseResultStatus.SUCCESS);
    });
    it("fails on HTTP 200", async () => {
      mockFetch({ status: 200, body: '{}' });
      const result = await testcontext.runner("TESTCASE#40");
      expect(result.status).toBe(TestCaseResultStatus.FAILURE);
    });
  });
};

// ---------------------------------------------------------------------------
// Listener tests
// ---------------------------------------------------------------------------

describe("TC13: Received Request Fulfilled Response (listener)", () => {
  let schema: any;
  beforeAll(async () => { schema = await getSchema(VERSION); });

  it("returns PENDING without making a fetch call", async () => {
    const testCases = await generateV3TestCases({
      testRunId: TEST_RUN_ID,
      footprints: MOCK_FOOTPRINTS,
      paginationLinks: PAGINATION_LINKS,
      baseUrl: BASE_URL,
      authTokenUrl: AUTH_URL,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      authRequestData: AUTH_REQUEST_DATA,
      version: VERSION,
      webhookUrl: WEBHOOK_URL,
    });
    const tc = testCases.find((t) => t.testKey === "TESTCASE#13")!;
    // Intercept fetch BEFORE calling runTestCase so no prior mock calls leak in
    const fetchMock = jest.fn().mockResolvedValue({ status: 200, text: async () => '{}', headers: { get: () => null } } as never) as any;
    global.fetch = fetchMock;
    const result = await runTestCase(BASE_URL, tc, ACCESS_TOKEN, VERSION);
    expect(result.status).toBe(TestCaseResultStatus.PENDING);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("TC14.B: Handle Rejected PCF Request (listener)", () => {
  let schema: any;
  beforeAll(async () => { schema = await getSchema(VERSION); });

  it("returns PENDING without making a fetch call", async () => {
    const testCases = await generateV3TestCases({
      testRunId: TEST_RUN_ID,
      footprints: MOCK_FOOTPRINTS,
      paginationLinks: PAGINATION_LINKS,
      baseUrl: BASE_URL,
      authTokenUrl: AUTH_URL,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      authRequestData: AUTH_REQUEST_DATA,
      version: VERSION,
      webhookUrl: WEBHOOK_URL,
    });
    const tc = testCases.find((t) => t.testKey === "TESTCASE#14.B")!;
    const fetchMock = jest.fn().mockResolvedValue({ status: 200, text: async () => '{}', headers: { get: () => null } } as never) as any;
    global.fetch = fetchMock;
    const result = await runTestCase(BASE_URL, tc, ACCESS_TOKEN, VERSION);
    expect(result.status).toBe(TestCaseResultStatus.PENDING);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
