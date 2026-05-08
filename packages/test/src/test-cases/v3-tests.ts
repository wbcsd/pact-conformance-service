import { randomUUID } from "crypto";
import { EventTypesV3 } from "../types";
import { TestContext, ListenerContext } from "../runner/test-context";
import { createTest, createListenerTest, createInitTest } from "../runner/test-definition";
import { assert, assertStatus, assertSchema, parseLinkHeader } from "./test-helpers";
import { randomString, getCorrectAuthHeaders, getIncorrectAuthHeaders } from "./test-helpers";

interface Footprint {
  id: string;
  productIds: string[];
  companyIds: string[];
  pcf: {
    geographyCountry?: string;
    geographyCountrySubdivision?: string;
    geographyRegionOrSubregion?: string;
    referencePeriodEnd: string;
  };
  productClassifications: string[];
  validityPeriodStart: string;
  validityPeriodEnd: string;
  status: string;
}

function isValidDate(date: Date) {
  return date instanceof Date && !isNaN(date.getTime());
}

const getDateOneDayBefore = (dateString: string): string => {
  const date = new Date(dateString);
  date.setDate(date.getDate() - 1);
  return date.toISOString();
};

const getDateOneDayAfter = (dateString: string): string => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};

/**
 * Derives filter parameter values from a sample footprint, used by Test Cases 20-39.
 * Falls back to PCF reference period when a footprint has no explicit validity period.
 */
const getFilterParameters = (footprints: Footprint[]) => {
  if (!footprints || !footprints[0]) {
    throw new Error(
      "Invalid footprints data: Missing required data structure. Please check the API response."
    );
  }

  const firstFootprint = footprints[0];

  const hasValidityPeriod =
    firstFootprint.validityPeriodStart &&
    firstFootprint.validityPeriodEnd &&
    isValidDate(new Date(firstFootprint.validityPeriodStart)) &&
    isValidDate(new Date(firstFootprint.validityPeriodEnd));

  let validityStart: string;
  let validityEnd: string;

  if (!hasValidityPeriod) {
    if (!firstFootprint.pcf.referencePeriodEnd) {
      throw new Error(
        "Invalid footprints data: Missing validityPeriod dates and pcf.referencePeriodEnd. Please check the API response."
      );
    }
    const referencePeriodEnd = new Date(firstFootprint.pcf.referencePeriodEnd);
    if (!isValidDate(referencePeriodEnd)) {
      throw new Error(
        "Invalid footprints data: Invalid pcf.referencePeriodEnd date. Please check the API response."
      );
    }
    validityStart = firstFootprint.pcf.referencePeriodEnd;
    const endDate = new Date(referencePeriodEnd);
    endDate.setFullYear(endDate.getFullYear() + 3);
    validityEnd = endDate.toISOString();
  } else {
    validityStart = firstFootprint.validityPeriodStart;
    validityEnd = firstFootprint.validityPeriodEnd;
  }

  return {
    productId: firstFootprint.productIds[0],
    productIds: firstFootprint.productIds,
    companyId: firstFootprint.companyIds[0],
    geography:
      firstFootprint.pcf.geographyCountry ||
      firstFootprint.pcf.geographyRegionOrSubregion ||
      firstFootprint.pcf.geographyCountrySubdivision ||
      "",
    classification: firstFootprint.productClassifications
      ? firstFootprint.productClassifications[0]
      : "",
    validOn: validityStart,
    validAfter: getDateOneDayBefore(validityStart),
    validBefore: getDateOneDayAfter(validityEnd),
    status: firstFootprint.status,
    id: firstFootprint.id,
  };
};

async function fetchNonEmptyFootprintList(ctx: TestContext, params: any) {
  // Construct list footprints URL with query parameters 
  const queryParams = new URLSearchParams(params).toString();
  const url = `${ctx.baseUrl}/3/footprints?${queryParams}`;
  const response = await ctx.request(url, "GET");

  // Test existence of json body and validate acording to schema
  assertStatus(response.status, 200);
  assert(!!response.data, "Expected JSON response body, but got none");
  assertSchema(response.data, ctx.schema.simpleListFootprintResponse);
  return response;
}

/**
 * V3Tests object with imperative test functions
 * Each test contains the actual execution logic: HTTP calls, status checks, schema validation, etc.
 */
export const V3Tests = {

  /**
   * Test Case 0: Initialize test run
   */
  InitializeTestRun: createInitTest(
    "Test Case 0: Initialize test run",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-0-initialize-test-run",
    async (ctx: TestContext) => {
      // This test case serves to initialize the TestContext which is used by all subsequent test cases.
      // If initialization fails, this test case will fail and prevent execution of the rest of the test
      // suite, providing early feedback on issues with auth, footprint fetching, schema loading, etc.

      // Discover the auth token endpoint via the OpenID Connect well-known configuration.
      // Discovery is optional under the spec, so fall back to /auth/token if it is unavailable.
      const authBaseUrl = ctx.startParams.customAuthBaseUrl || ctx.baseUrl;
      const openIdConfigUrl = `${authBaseUrl}/.well-known/openid-configuration`;
      ctx.authTokenUrl = `${authBaseUrl}/auth/token`;
      ctx.info(`Attempting OpenID token endpoint discovery at ${openIdConfigUrl}`);
      try {
        const discovery = await ctx.request(openIdConfigUrl, "GET", {});
        if (discovery.status === 200 && discovery.data?.token_endpoint) {
          ctx.authTokenUrl = discovery.data.token_endpoint;
          ctx.info(`Discovered token endpoint from OpenID configuration: ${ctx.authTokenUrl}`);
        } else {
          ctx.info(`No OpenID configuration available (status ${discovery.status}); falling back to ${ctx.authTokenUrl}`);
        }
      } catch (err: any) {
        ctx.info(`OpenID discovery request failed (${err.message}); falling back to ${ctx.authTokenUrl}`);
      }

      // Build the client credentials grant request body, including any optional scope/audience/resource params.
      ctx.authRequestData = new URLSearchParams({
        grant_type: "client_credentials",
        ...(ctx.startParams.scope && { scope: ctx.startParams.scope }),
        ...(ctx.startParams.audience && { audience: ctx.startParams.audience }),
        ...(ctx.startParams.resource && { resource: ctx.startParams.resource }),
      }).toString()

      // Request an access token from the discovered (or fallback) token endpoint using HTTP Basic auth.
      ctx.info(`Requesting access token from ${ctx.authTokenUrl} with clientId: ${ctx.startParams.clientId}`);
      const encodedCredentials = Buffer.from(
        `${ctx.startParams.clientId}:${ctx.startParams.clientSecret}`
      ).toString("base64");
      const tokenResponse = await ctx.request(
        ctx.authTokenUrl,
        "POST",
        {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${encodedCredentials}`,
        },
        ctx.authRequestData
      );
      assertStatus(tokenResponse.status, 200);
      assert(!!tokenResponse.data?.access_token, "Access token was not present in the auth token response");
      ctx.accessToken = tokenResponse.data.access_token;

      // Set common headers for future requests
      ctx.headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.accessToken}`,
      }

      // Fetch footprints
      const footprintsResponse = await ctx.request(`${ctx.baseUrl}/3/footprints`, "GET")
      ctx.footprints = footprintsResponse.data?.data
      assert(ctx.footprints?.length >= 2, "At least two footprints are required to run the tests, but none were returned from the API");
    
      // Get link header for pagination test case 5
      const paginationResponse = await ctx.request(`${ctx.baseUrl}/3/footprints?limit=1`, "GET")
      ctx.paginationLinks = parseLinkHeader(paginationResponse.headers["link"])

      // Store productIds on the test run data for use in callback test cases
      assert(ctx.footprints[0].productIds?.length > 0, "Footprints must contain at least one product ID");      
      ctx.testRun.data = { productIds: ctx.footprints[0].productIds }

      // Determine filter parameters for test cases 20-39
      ctx.filterParams = getFilterParameters(ctx.footprints)
    
      ctx.info("Test context initialized");
    }
  ),

  /**
   * Test Case 1: Obtain auth token with valid credentials
   */
  ObtainAuthTokenWithValidCredentials: createTest(
    "Test Case 1: Obtain auth token with valid credentials",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-1-obtain-auth-token-with-valid-credentials",
    async (ctx: TestContext) => {
      const headers = {...getCorrectAuthHeaders(ctx.baseUrl, ctx.startParams.clientId, ctx.startParams.clientSecret) }
      const response = await ctx.request(ctx.authTokenUrl, "POST", headers, ctx.authRequestData)
      assertStatus(response.status, 200)
    }
  ),

  /**
   * Test Case 2: Obtain auth token with invalid credentials
   */
  ObtainAuthTokenWithInvalidCredentials: createTest(
    "Test Case 2: Obtain auth token with invalid credentials",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-2-obtain-auth-token-with-invalid-credentials",
    async (ctx: TestContext) => {
      const headers = { ...getIncorrectAuthHeaders(ctx.baseUrl) }
      const response = await ctx.request(ctx.authTokenUrl, "POST", headers, ctx.authRequestData)
      assertStatus(response.status, [400, 401])
    }
  ),

  /**
   * Test Case 3: Get PCF using GetFootprint
   */
  GetPCFUsingGetFootprint: createTest(
    "Test Case 3: Get PCF using GetFootprint",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-3-get-pcf-using-getfootprint",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints/${ctx.filterParams.id}`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");
      assertSchema(response.data, ctx.schema.getFootprintResponse);

      assert(
        response.data?.data?.id === ctx.filterParams.id,
        `Returned footprint does not match the requested footprint with id ${ctx.filterParams.id}`
      );
    }
  ),

  /**
   * Test Case 4: Get all PCFs using ListFootprints
   */
  GetAllPCFsUsingListFootprints: createTest(
    "Test Case 4: Get all PCFs using ListFootprints",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-4-get-all-pcfs-using-listfootprints",
    async (ctx: TestContext) => {
      const url = `${ctx.baseUrl}/3/footprints`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, [200, 202]);
      assert(!!response.data, "Expected JSON response body, but got none");
      assertSchema(response.data, ctx.schema.listFootprintResponse);

      assert(
        response.data?.data?.length === ctx.footprints.length,
        "Number of footprints does not match"
      );
    }
  ),

  /**
   * Test Case 5: Pagination link implementation
   */
  PaginationLinkImplementation: createTest(
    "Test Case 5: Pagination link implementation of Action ListFootprints",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-5-pagination-link-implementation-of-action-listfootprints",
    async (ctx: TestContext) => {
      const paginationUrl = Object.values(ctx.paginationLinks)[0];
      assert(!!paginationUrl, "No pagination link found");

      const response = await ctx.request(paginationUrl, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");
      assertSchema(response.data, ctx.schema.simpleListFootprintResponse);
    }
  ),

  /**
   * Test Case 6: Attempt ListFootprints with Invalid Token
   */
  ListFootprintsWithInvalidToken: createTest(
    "Test Case 6: Attempt ListFootPrints with Invalid Token",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-6-attempt-listfootprints-with-invalid-token",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      };
      const url = `${ctx.baseUrl}/3/footprints`;
      const response = await ctx.request(url, "GET", headers);

      assertStatus(response.status, [400, 401]);

      if (response.data?.code !== "BadRequest") {
        ctx.warn(`Expected error code BadRequest but received ${response.data?.code}`);
      }
    }
  ),

  /**
   * Test Case 7: Attempt GetFootprint with Invalid Token
   */
  GetFootprintWithInvalidToken: createTest(
    "Test Case 7: Attempt GetFootprint with Invalid Token",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-7-attempt-getfootprint-with-invalid-token",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      };
      const url = `${ctx.baseUrl}/3/footprints/${ctx.filterParams.id}`;
      const response = await ctx.request(url, "GET", headers);

      assertStatus(response.status, [400, 401]);

      if (response.data?.code !== "BadRequest") {
        ctx.warn(`Expected error code BadRequest but received ${response.data?.code}`);
      }
    }
  ),

  /**
   * Test Case 8: Attempt GetFootprint with Non-Existent PfId
   */
  GetFootprintWithNonExistentId: createTest(
    "Test Case 8: Attempt GetFootprint with Non-Existent PfId",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-8-attempt-getfootprint-with-non-existent-pfid",
    async (ctx: TestContext) => {
      const url = `${ctx.baseUrl}/3/footprints/00000000-0000-0000-0000-000000000000`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, [400, 404]);
      assert(
        response.data?.code === "NotFound" || response.data?.code === "BadRequest",
        "Expected error code NotFound or BadRequest in response"
      );
    }
  ),

  /**
   * Test Case 9: Attempt Authentication through HTTP (non-HTTPS)
   */
  AuthenticationThroughHTTP: createTest(
    "Test Case 9: Attempt Authentication through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-9-attempt-authentication-through-http-non-https",
    async (ctx: TestContext) => {
      const old = ctx.authTokenUrl;
      ctx.authTokenUrl = ctx.authTokenUrl.replace("https", "http");
      let threw = false;
      try { await V3Tests.ObtainAuthTokenWithValidCredentials.action!(ctx); } catch { threw = true; }
      ctx.authTokenUrl = old;
      assert(threw, "Auth token request unexpectedly succeeded over HTTP");
    }
  ),

  /**
   * Test Case 10: Attempt ListFootprints through HTTP (non-HTTPS)
   */
  ListFootprintsThroughHTTP: createTest(
    "Test Case 10: Attempt ListFootprints through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-10-attempt-listfootprints-through-http-non-https",
    async (ctx: TestContext) => {      
      const old = ctx.baseUrl;
      ctx.baseUrl = ctx.baseUrl.replace("https", "http");
      let threw = false;
      try { await V3Tests.GetAllPCFsUsingListFootprints.action!(ctx); } catch { threw = true; }
      ctx.baseUrl = old;
      assert(threw, "ListFootprints unexpectedly succeeded over HTTP");
    }
  ),

  /**
   * Test Case 11: Attempt GetFootprint through HTTP (non-HTTPS)
   */
  GetFootprintThroughHTTP: createTest(
    "Test Case 11: Attempt GetFootprint through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-11-attempt-getfootprint-through-http-non-https",
    async (ctx: TestContext) => {
      const old = ctx.baseUrl;
      ctx.baseUrl = ctx.baseUrl.replace("https", "http");
      let threw = false;
      try { await V3Tests.GetPCFUsingGetFootprint.action!(ctx); } catch { threw = true; }
      ctx.baseUrl = old;
      assert(threw, "GetFootprint unexpectedly succeeded over HTTP");
    }
  ),

  /**
   * Test Case 12: Send Asynchronous PCF Request
   */
  SendAsyncPCFRequest: createTest(
    "Test Case 12: Send Asynchronous PCF Request",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-12-send-pcf-creation-request-async",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        "Content-Type": "application/cloudevents+json; charset=UTF-8"
      };

      const body = {
        specversion: "1.0",
        id: ctx.testRun.testRunId + "/13", // Indicate the callback test case
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV3.CREATED,
        data: {
          productId: ctx.filterParams.productIds,
          comment: "Please send PCF data for this year.",
        },
      };

      const url = `${ctx.baseUrl}/3/events`;
      ctx.info(`Sending asynchronous PCF request to ${url} with id: ${body.id} and productIds: ${ctx.filterParams.productIds} - this should trigger a callback with a request fulfilled event`);
      
      const response = await ctx.request(url, "POST", headers, body);

      assertStatus(response.status, 200);
    }
  ),

  /**
   * Test Case 13: Received Request Fulfilled Response (Callback)
   */
  ReceivedRequestFulfilledResponse: createListenerTest(
    "Test Case 13: Received Request Fulfilled Response",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-13-call-back-with-a-request-fulfilled-event",
    async (ctx) => {
      // This callback will be triggered by the system when it receives the request fulfilled event, and will contain the logic to validate the event payload and update the test result accordingly.
      // The actual processing of the event is handled in the EventHandler service, which will call a separate function to process accepted events (Test Case 13) and rejected events (Test Case 14.B)
      assert(ctx.path === "/3/events", "Callback received on incorrect path");
      assertSchema(ctx.data, ctx.schema.events?.fulfilled);
      const requestedProductIds = (ctx.testRun.data as any).productIds as string[] | undefined;
      for (const pf of ctx.data.data.pfs) {
        for (const productId of pf.productIds) {
          assert(
            requestedProductIds?.includes(productId) ?? false,
            `Received product ID ${productId} was not in the original request`
          );
        }
      }
    }
  ),

  /**
   * Test Case 14.A: Send Asynchronous Request to be Rejected
   */
  testCase14A_SendAsyncRequestToBeRejected: createTest(
    "Test Case 14.A: Send Asynchronous Request to be Rejected",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14a-request-for-the-creation-of-a-pcf-to-be-rejected",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        "Content-Type": "application/cloudevents+json; charset=UTF-8"
      };

      const body = {
        specversion: "1.0",
        id: ctx.testRun.testRunId + "/14.B", // Indicate the callback test case
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV3.CREATED,
        data: {
          productId: ["urn:pact:null"],
          comment: "Please send PCF data for this year.",
        },
      };

      const url = `${ctx.baseUrl}/3/events`;
      const response = await ctx.request(url, "POST", headers, body);

      assertStatus(response.status, 200);
    }
  ),

  /**
   * Test Case 14.B: Handle Rejected PCF Request (Callback)
   */
  testCase14B_HandleRejectedPCFRequest: createListenerTest(
    "Test Case 14.B: Handle Rejected PCF Request",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14b-call-back-with-a-request-rejected-event",
    async (ctx: ListenerContext) => {
      assert(ctx.path === "/3/events", `Invalid request path: expected /3/events, but received ${ctx.path}`);
      assertSchema(ctx.data, ctx.schema.events?.rejected);
      assert(
        ctx.data?.data?.error?.code && ctx.data?.data?.error?.message,
        "Rejected event must contain an error object with a code and message"
      );
    }
  ),

  /**
   * Test Case 15: Receive Notification of PCF Update (Published Event)
   */
  ReceiveNotificationOfPCFUpdate: createTest(
    "Test Case 15: Receive Notification of PCF Update (Published Event)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-15-receive-notification-of-pcf-update-published-event",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        "Content-Type": "application/cloudevents+json; charset=UTF-8"
      };

      const body = {
        type: EventTypesV3.PUBLISHED,
        specversion: "1.0",
        id: randomUUID(),
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      };

      const url = `${ctx.baseUrl}/3/events`;
      const response = await ctx.request(url, "POST", headers, body);

      assertStatus(response.status, 200);
    }
  ),

  /**
   * Test Case 16: Attempt Action Events with Invalid Token
   */
  ActionEventsWithInvalidToken: createTest(
    "Test Case 16: Attempt Action Events with Invalid Token",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-16-attempt-action-events-with-invalid-token",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      };

      const body = {
        type: EventTypesV3.PUBLISHED,
        specversion: "1.0",
        id: ctx.testRun.testRunId + "/16",
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      };

      const url = `${ctx.baseUrl}/3/events`;
      const response = await ctx.request(url, "POST", headers, body);

      assertStatus(response.status, [400, 401]);

      if (response.data?.code !== "BadRequest") {
        ctx.warn(`Expected error code BadRequest but received ${response.data?.code}`);
      }
    }
  ),

  /**
   * Test Case 17: Attempt Action Events through HTTP (non-HTTPS)
   */
  ActionEventsThroughHTTP: createTest(
    "Test Case 17: Attempt Action Events through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-17-attempt-action-events-through-http-non-https",
    async (ctx: TestContext) => {

      const old = ctx.baseUrl;
      ctx.baseUrl = ctx.baseUrl.replace("https", "http");
      let threw = false;
      try { await V3Tests.ReceiveNotificationOfPCFUpdate.action!(ctx); } catch { threw = true; }
      ctx.baseUrl = old;
      assert(threw, "Action Events unexpectedly succeeded over HTTP");
    }
  ),

  /**
   * Test Case 18: OpenId Connect-based Authentication Flow
   */
  OpenIdConnectAuthenticationFlow: createTest(
    "Test Case 18: OpenId Connect-based Authentication Flow",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-18-openid-connect-based-authentication-flow",
    async (ctx: TestContext) => {
      const headers = {
        ...getCorrectAuthHeaders(ctx.baseUrl, ctx.startParams.clientId, ctx.startParams.clientSecret),
      };
      const response = await ctx.request(ctx.authTokenUrl, "POST", headers, ctx.authRequestData);
      assertStatus(response.status, 200);
    }
  ),

  /**
   * Test Case 19: OpenId Connect-based authentication flow with incorrect credentials
   */
  OpenIdConnectAuthFlowWithIncorrectCredentials: createTest(
    "Test Case 19: OpenId connect-based authentication flow with incorrect credentials",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-19-openid-connect-based-authentication-flow-with-incorrect-credentials",
    async (ctx: TestContext) => {
      const headers = {
        ...getIncorrectAuthHeaders(ctx.baseUrl),
      };
      const response = await ctx.request(ctx.authTokenUrl, "POST", headers, ctx.authRequestData);
      assertStatus(response.status, [400, 401]);
    }
  ),

  /**
   * Test Case 20: Filter by ProductId
   */
  FilterByProductId: createTest(
    "Test Case 20: V3 Filtering Functionality: Get Filtered List of Footprints by \"productId\" parameter",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-20-v3-filtering-functionality-get-filtered-list-of-footprints-by-productid-parameter",
    async (ctx: TestContext) => {

      const response = await fetchNonEmptyFootprintList(ctx, { productId: ctx.filterParams.productId });

      const allMatch = response.data?.data?.every((footprint: { productIds: string[] }) =>
        footprint.productIds.includes(ctx.filterParams.productId)
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the condition: 'productIds contains ${ctx.filterParams.productId}'`
      );
    }
  ),

  /**
   * Test Case 21: Filter by CompanyId
   */
  FilterByCompanyId: createTest(
    "Test Case 21: V3 Filtering Functionality: Get Filtered List of Footprints by \"companyId\" parameter",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-21-v3-filtering-functionality-get-filtered-list-of-footprints-by-companyid-parameter",
    async (ctx: TestContext) => {

      const response = await fetchNonEmptyFootprintList(ctx, { companyId: ctx.filterParams.companyId });

      const allMatch = response.data?.data?.every((footprint: { companyIds: string[] }) =>
        footprint.companyIds.includes(ctx.filterParams.companyId)
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the condition: 'companyIds contains ${ctx.filterParams.companyId}'`
      );
    }
  ),

  /**
   * Test Case 22: Filter by Geography
   */
  FilterByGeography: createTest(
    "Test Case 22: V3 Filtering Functionality: Get Filtered List of Footprints by \"geography\" parameter",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-22-v3-filtering-functionality-get-filtered-list-of-footprints-by-geography-parameter",
    async (ctx: TestContext) => {

      const response = await fetchNonEmptyFootprintList(ctx, { geography: ctx.filterParams.geography });

      if ((ctx.filterParams.geography ?? '') === '') {
        assert(
          response.data?.data?.length === ctx.footprints.length,
          "When no geography is provided, all footprints should be returned"
        );
      } else {
        const allMatch = response.data?.data?.every(
          (footprint: {
            pcf: {
              geographyCountry?: string;
              geographyRegionOrSubregion?: string;
              geographyCountrySubdivision?: string;
            };
          }) =>
            footprint.pcf.geographyCountry === ctx.filterParams.geography ||
            footprint.pcf.geographyRegionOrSubregion === ctx.filterParams.geography ||
            footprint.pcf.geographyCountrySubdivision === ctx.filterParams.geography
        );
        assert(
          !!allMatch,
          `One or more footprints do not match the condition: 'pcf.geographyCountry = ${ctx.filterParams.geography}'`
        );
      }
    }
  ),

  /**
   * Test Case 23: Filter by Classification
   */
  FilterByClassification: createTest(
    "Test Case 23: V3 Filtering Functionality: Get Filtered List of Footprints by \"classification\" parameter",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-23-v3-filtering-functionality-get-filtered-list-of-footprints-by-classification-parameter",
    async (ctx: TestContext) => {

      const response = await fetchNonEmptyFootprintList(ctx, { classification: ctx.filterParams.classification });

      if ((ctx.filterParams.classification ?? '') === '') {
        assert(
          response.data?.data?.length === ctx.footprints.length,
          "When no classification is provided, all footprints should be returned"
        );
      } else {
        const allMatch = response.data?.data?.every((footprint: { productClassifications: string[] }) =>
          footprint.productClassifications.includes(ctx.filterParams.classification)
        );
        assert(
          !!allMatch,
          `One or more footprints do not match the condition: 'productClassifications contains ${ctx.filterParams.classification}'`
        );
      }
    }
  ),

  /**
   * Test Case 24: Filter by ValidOn
   */
  FilterByValidOn: createTest(
    "Test Case 24: V3 Filtering Functionality: Get Filtered List of Footprints by \"validOn\" parameter",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-24-v3-filtering-functionality-get-filtered-list-of-footprints-by-validon-parameter",
    async (ctx: TestContext) => {

      const response = await fetchNonEmptyFootprintList(ctx, { validOn: ctx.filterParams.validOn });

      const allMatch = response.data?.data?.every(
        (footprint: {
          validityPeriodStart: string;
          validityPeriodEnd: string;
          pcf: { referencePeriodEnd: string };
        }) => {
          const hasValidityPeriod =
            footprint.validityPeriodStart &&
            footprint.validityPeriodEnd &&
            isValidDate(new Date(footprint.validityPeriodStart)) &&
            isValidDate(new Date(footprint.validityPeriodEnd));

          if (hasValidityPeriod) {
            return (
              new Date(footprint.validityPeriodStart) <= new Date(ctx.filterParams.validOn) &&
              new Date(footprint.validityPeriodEnd) >= new Date(ctx.filterParams.validOn)
            );
          } else if (footprint.pcf.referencePeriodEnd) {
            const refEnd = new Date(footprint.pcf.referencePeriodEnd);
            const refEndPlus3Years = new Date(refEnd);
            refEndPlus3Years.setFullYear(refEndPlus3Years.getFullYear() + 3);
            return (
              refEnd <= new Date(ctx.filterParams.validOn) &&
              refEndPlus3Years >= new Date(ctx.filterParams.validOn)
            );
          }
          return false;
        }
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the condition: 'validityPeriodStart <= ${ctx.filterParams.validOn} <= validityPeriodEnd' or fallback reference period logic`
      );
    }
  ),

  /**
   * Test Case 25: Filter by ValidAfter
   */
  FilterByValidAfter: createTest(
    "Test Case 25: V3 Filtering Functionality: Get Filtered List of Footprints by \"validAfter\" parameter",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-25-v3-filtering-functionality-get-filtered-list-of-footprints-by-validafter-parameter",
    async (ctx: TestContext) => {

      const response = await fetchNonEmptyFootprintList(ctx, { validAfter: ctx.filterParams.validAfter });

      const allMatch = response.data?.data?.every(
        (footprint: {
          validityPeriodStart: string;
          pcf: { referencePeriodEnd: string };
        }) => {
          const hasValidityPeriod =
            footprint.validityPeriodStart &&
            isValidDate(new Date(footprint.validityPeriodStart));

          if (hasValidityPeriod) {
            return new Date(footprint.validityPeriodStart) > new Date(ctx.filterParams.validAfter);
          } else if (footprint.pcf.referencePeriodEnd) {
            return new Date(footprint.pcf.referencePeriodEnd) > new Date(ctx.filterParams.validAfter);
          }
          return false;
        }
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the condition: 'validityPeriodStart > ${ctx.filterParams.validAfter}' or fallback reference period logic`
      );
    }
  ),

  /**
   * Test Case 26: Filter by ValidBefore
   */
  FilterByValidBefore: createTest(
    "Test Case 26: V3 Filtering Functionality: Get Filtered List of Footprints by \"validBefore\" parameter",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-26-v3-filtering-functionality-get-filtered-list-of-footprints-by-validbefore-parameter",
    async (ctx: TestContext) => {

      const response = await fetchNonEmptyFootprintList(ctx, { validBefore: ctx.filterParams.validBefore });

      const allMatch = response.data?.data?.every(
        (footprint: {
          validityPeriodEnd: string;
          pcf: { referencePeriodEnd: string };
        }) => {
          const hasValidityPeriod =
            footprint.validityPeriodEnd &&
            isValidDate(new Date(footprint.validityPeriodEnd));

          if (hasValidityPeriod) {
            return new Date(footprint.validityPeriodEnd) < new Date(ctx.filterParams.validBefore);
          } else if (footprint.pcf.referencePeriodEnd) {
            const refEnd = new Date(footprint.pcf.referencePeriodEnd);
            const refEndPlus3Years = new Date(refEnd);
            refEndPlus3Years.setFullYear(refEndPlus3Years.getFullYear() + 3);
            return refEndPlus3Years < new Date(ctx.filterParams.validBefore);
          }
          return false;
        }
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the condition: 'validityPeriodEnd < ${ctx.filterParams.validBefore}' or fallback reference period logic`
      );
    }
  ),

  /**
   * Test Case 27: Filter by Status
   */
  FilterByStatus: createTest(
    "Test Case 27: V3 Filtering Functionality: Get Filtered List of Footprints by \"status\" parameter",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-27-v3-filtering-functionality-get-filtered-list-of-footprints-by-status-parameter",
    async (ctx: TestContext) => {

      const response = await fetchNonEmptyFootprintList(ctx, { status: ctx.filterParams.status });

      const allMatch = response.data?.data?.every(
        (footprint: { status: string }) => footprint.status === ctx.filterParams.status
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the condition: 'status = ${ctx.filterParams.status}'`
      );
    }
  ),

  /**
   * Test Case 28: Filter by Status and ProductId
   */
  FilterByStatusAndProductId: createTest(
    "Test Case 28: V3 Filtering Functionality: Get Filtered List of Footprints by both \"status\" and \"productId\" parameters",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-28-v3-filtering-functionality-get-filtered-list-of-footprints-by-both-status-and-productid-parameters",
    async (ctx: TestContext) => {

      const response = await fetchNonEmptyFootprintList(ctx, { status: ctx.filterParams.status, productId: ctx.filterParams.productId });

      const allMatch = response.data?.data?.every(
        (footprint: { status: string; productIds: string[] }) =>
          footprint.status === ctx.filterParams.status &&
          footprint.productIds.includes(ctx.filterParams.productId)
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the condition: 'status = ${ctx.filterParams.status} AND productIds contains ${ctx.filterParams.productId}'`
      );
    }
  ),

  /**
   * Test Case 29: Filter by Multiple CompanyIds (OR logic)
   */
  FilterByMultipleCompanyIdsOrLogic: createTest(
    "Test Case 29: V3 Filtering Functionality: Get Filtered List of Footprints by multiple filter parameters using OR logic",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-29-v3-filtering-functionality-get-filtered-list-of-footprints-by-multiple-filter-parameters-using-or-logic-positive-test-case",
    async (ctx: TestContext) => {

      const response = await fetchNonEmptyFootprintList(ctx, [['companyId', ctx.filterParams.companyId], ['companyId', randomString(8)], ['companyId', randomString(8)]]);

      const allMatch = response.data?.data?.every((footprint: { companyIds: string[] }) =>
        footprint.companyIds.includes(ctx.filterParams.companyId)
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the companyId filter in OR logic test: ${ctx.filterParams.companyId}`
      );
    }
  ),

  /**
   * Test Case 30: Filter by ProductId (Negative)
   */
  FilterByProductIdNegative: createTest(
    "Test Case 30: V3 Filtering Functionality: Get Filtered List of Footprints by \"productId\" parameter (negative test case)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-30-v3-filtering-functionality-get-filtered-list-of-footprints-by-productid-parameter-negative-test-case",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?productId=urn:bogus:product:${randomString(16)}`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus productId filter"
      );
    }
  ),

  /**
   * Test Case 31: Filter by CompanyId (Negative)
   */
  FilterByCompanyIdNegative: createTest(
    "Test Case 31: V3 Filtering Functionality: Get Filtered List of Footprints by \"companyId\" parameter (negative test case)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-31-v3-filtering-functionality-get-filtered-list-of-footprints-by-companyid-parameter-negative-test-case",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?companyId=urn:bogus:company:${randomString(16)}`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus companyId filter"
      );
    }
  ),

  /**
   * Test Case 32: Filter by Geography (Negative)
   */
  FilterByGeographyNegative: createTest(
    "Test Case 32: V3 Filtering Functionality: Get Filtered List of Footprints by \"geography\" parameter (negative test case)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-32-v3-filtering-functionality-get-filtered-list-of-footprints-by-geography-parameter-negative-test-case",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?geography=XX`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus geography filter"
      );
    }
  ),

  /**
   * Test Case 33: Filter by Classification (Negative)
   */
  FilterByClassificationNegative: createTest(
    "Test Case 33: V3 Filtering Functionality: Get Filtered List of Footprints by \"classification\" parameter (negative test case)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-33-v3-filtering-functionality-get-filtered-list-of-footprints-by-classification-parameter-negative-test-case",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?classification=urn:bogus:classification:${randomString(16)}`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus classification filter"
      );
    }
  ),

  /**
   * Test Case 34: Filter by ValidOn (Negative)
   */
  FilterByValidOnNegative: createTest(
    "Test Case 34: V3 Filtering Functionality: Get Filtered List of Footprints by \"validOn\" parameter (negative test case)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-34-v3-filtering-functionality-get-filtered-list-of-footprints-by-validon-parameter-negative-test-case",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?validOn=1900-01-01T00:00:00Z`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus validOn filter (date in the past: 1900-01-01T00:00:00Z)"
      );
    }
  ),

  /**
   * Test Case 35: Filter by ValidAfter (Negative)
   */
  FilterByValidAfterNegative: createTest(
    "Test Case 35: V3 Filtering Functionality: Get Filtered List of Footprints by \"validAfter\" parameter (negative test case)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-35-v3-filtering-functionality-get-filtered-list-of-footprints-by-validafter-parameter-negative-test-case",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?validAfter=2099-12-31T23:59:59Z`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus validAfter filter (date in the future: 2099-12-31T23:59:59Z)"
      );
    }
  ),

  /**
   * Test Case 36: Filter by ValidBefore (Negative)
   */
  FilterByValidBeforeNegative: createTest(
    "Test Case 36: V3 Filtering Functionality: Get Filtered List of Footprints by \"validBefore\" parameter (negative test case)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-36-v3-filtering-functionality-get-filtered-list-of-footprints-by-validbefore-parameter-negative-test-case",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?validBefore=1900-01-01T00:00:00Z`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus validBefore filter (date in the past: 1900-01-01T00:00:00Z)"
      );
    }
  ),

  /**
   * Test Case 37: Filter by Status (Negative)
   */
  FilterByStatusNegative: createTest(
    "Test Case 37: V3 Filtering Functionality: Get Filtered List of Footprints by \"status\" parameter (negative test case)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-37-v3-filtering-functionality-get-filtered-list-of-footprints-by-status-parameter-negative-test-case",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?status=BogusStatus${randomString(8)}`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus status filter"
      );
    }
  ),

  /**
   * Test Case 38: Filter by Multiple Parameters AND logic (Negative)
   */
  FilterByMultipleParamsAndLogicNegative: createTest(
    "Test Case 38: V3 Filtering Functionality: Get Filtered List of Footprints by multilpe filter parameters using AND logic (negative test case)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-38-v3-filtering-functionality-get-filtered-list-of-footprints-by-multilpe-filter-parameters-using-and-logic-negative-test-case",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?companyId=urn:bogus:company:${randomString(8)}&productId=urn:bogus:product:${randomString(16)}`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus companyId and productId filters"
      );
    }
  ),

  /**
   * Test Case 39: Filter by Multiple CompanyIds OR logic (Negative)
   */
  FilterByMultipleCompanyIdsOrLogicNegative: createTest(
    "Test Case 39: V3 Filtering Functionality: Get Filtered List of Footprints by multilpe filter parameters using OR logic (negative test case)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-39-v3-filtering-functionality-get-filtered-list-of-footprints-by-multilpe-filter-parameters-using-or-logic-negative-test-case",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?companyId=urn:bogus:company:${randomString(8)}&companyId=urn:bogus:company:${randomString(8)}&companyId=urn:bogus:company:${randomString(8)}`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus companyId filters in OR logic test"
      );
    }
  ),

  /**
   * Test Case 40: Failed Published Event - Malformed Request
   */
  FailedPublishedEventMalformedRequest: createTest(
    "Test Case 40: Failed to Receive Notification of PCF Update (Published Event) - Malformed Request",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-40-failed-to-receive-notification-of-pcf-update-published-event-malformed-request",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      };

      const body = {
        type: EventTypesV3.PUBLISHED,
        specversion: "1.0",
        id: randomUUID(),
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["urn:gtin:4712345060507"],
        },
      };

      const url = `${ctx.baseUrl}/3/events`;
      const response = await ctx.request(url, "POST", headers, body);

      assertStatus(response.status, 400);
    }
  ),
};
