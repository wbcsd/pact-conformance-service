import { randomUUID } from "crypto";
import logger from "../utils/logger";
import { TestResult, TestCaseResultStatus, EventTypesV3 } from "../services/types";
import { randomString, getCorrectAuthHeaders, getIncorrectAuthHeaders } from "../utils/authUtils";
import { TestContext, createTest, assert, assertStatus, assertSchema, makeRequest } from "./test-helpers";


/**
 * V3Tests object with imperative test functions
 * Each test contains the actual execution logic: HTTP calls, status checks, schema validation, etc.
 */
export const V3Tests = {

  /**
   * Test Case 1: Obtain auth token with valid credentials
   */
  ObtainAuthTokenWithValidCredentials: createTest(
    "Test Case 1: Obtain auth token with valid credentials",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-1-obtain-auth-token-with-valid-credentials",
    async (ctx: TestContext) => {
      const headers = {
        ...getCorrectAuthHeaders(ctx.baseUrl, ctx.clientId, ctx.clientSecret)
      }

      const response = await makeRequest(
        ctx.authTokenUrl,
        "POST",
        headers,
        ctx.authRequestData
      )
      
      assertStatus(response.status, 200)

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 2: Obtain auth token with invalid credentials
   */
  ObtainAuthTokenWithInvalidCredentials: createTest(
    "Test Case 2: Obtain auth token with invalid credentials",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-2-obtain-auth-token-with-invalid-credentials",
    async (ctx: TestContext) => {
      const headers = {
        ...getIncorrectAuthHeaders(ctx.baseUrl)
      }
      const response = await makeRequest(
        ctx.authTokenUrl,
        "POST",
        headers,
        ctx.authRequestData
      )

      assertStatus(response.status, [400, 401])

      return { apiResponse: response.text };
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
      const response = await makeRequest(url, "GET", ctx.headers);

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.getFootprintResponse);

      assert(
        response.data?.data?.id === ctx.filterParams.id,
        `Returned footprint does not match the requested footprint with id ${ctx.filterParams.id}`
      );

      return { apiResponse: response.text };
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
      const response = await makeRequest(url, "GET", ctx.headers);

      assertStatus(response.status, [200, 202]);

      assert(!!response.data, "Expected JSON response body, but got none");
      assertSchema(response.data, ctx.schema.listFootprintResponse);

      assert(
        response.data?.data?.length === ctx.footprints.data.length,
        "Number of footprints does not match"
      );

      return { apiResponse: response.text };
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

      const response = await makeRequest(paginationUrl, "GET", ctx.headers);

      assertStatus(response.status, 200);

      assert(!!response.data, "Expected JSON response body, but got none");
      assertSchema(response.data, ctx.schema.simpleListFootprintResponse);

      return { apiResponse: response.text };
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
        "Content-Type": "application/json",
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      };

      const url = `${ctx.baseUrl}/3/footprints`;
      const response = await makeRequest(url, "GET", headers);

      assertStatus(response.status, [400, 401]);

      if (response.data?.code !== "BadRequest") {
        logger.warn(
          `Test case "Test Case 6: Attempt ListFootPrints with Invalid Token": Expected error code BadRequest but received ${response.data?.code}`
        );
      }

      return { apiResponse: response.text };
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
        "Content-Type": "application/json",
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      };

      const url = `${ctx.baseUrl}/3/footprints/${ctx.filterParams.id}`;
      const response = await makeRequest(url, "GET", headers);

      assertStatus(response.status, [400, 401]);

      if (response.data?.code !== "BadRequest") {
        logger.warn(
          `Test case "Test Case 7: Attempt GetFootprint with Invalid Token": Expected error code BadRequest but received ${response.data?.code}`
        );
      }

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 8: Attempt GetFootprint with Non-Existent PfId
   */
  GetFootprintWithNonExistentId: createTest(
    "Test Case 8: Attempt GetFootprint with Non-Existent PfId",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-8-attempt-getfootprint-with-non-existent-pfid",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints/random-string-as-id-${randomString(16)}`;
      const response = await makeRequest(url, "GET", ctx.headers);

      assertStatus(response.status, [400, 404]);
      assert(
        response.data?.code === "NotFound",
        "Expected error code NotFound in response"
      );

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 9: Attempt Authentication through HTTP (non-HTTPS)
   */
  AuthenticationThroughHTTP: createTest(
    "Test Case 9: Attempt Authentication through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-9-attempt-authentication-through-http-non-https",
    async (ctx: TestContext) => {
      
      const copy = { ...ctx, authTokenUrl: ctx.authTokenUrl.replace("https", "http") }
      const result: TestResult = await V3Tests.ObtainAuthTokenWithValidCredentials(copy)
      assert(result.status !== TestCaseResultStatus.SUCCESS, "Auth token request unexpectedly succeeded over HTTP")
      
      result.status = TestCaseResultStatus.SUCCESS;
      return result;
    }
  ),

  /**
   * Test Case 10: Attempt ListFootprints through HTTP (non-HTTPS)
   */
  ListFootprintsThroughHTTP: createTest(
    "Test Case 10: Attempt ListFootprints through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-10-attempt-listfootprints-through-http-non-https",
    async (ctx: TestContext) => {
      
      const copy = { ...ctx, baseUrl: ctx.baseUrl.replace("https", "http") }
      const result: TestResult = await V3Tests.GetAllPCFsUsingListFootprints(copy)
      assert(result.status !== TestCaseResultStatus.SUCCESS, "ListFootprints unexpectedly succeeded over HTTP")
      
      result.status = TestCaseResultStatus.SUCCESS;
      return result;
    }
  ),

  /**
   * Test Case 11: Attempt GetFootprint through HTTP (non-HTTPS)
   */
  GetFootprintThroughHTTP: createTest(
    "Test Case 11: Attempt GetFootprint through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-11-attempt-getfootprint-through-http-non-https",
    async (ctx: TestContext) => {

      const copy = { ...ctx, baseUrl: ctx.baseUrl.replace("https", "http") }
      const result: TestResult = await V3Tests.GetPCFUsingGetFootprint(copy)
      assert(result.status !== TestCaseResultStatus.SUCCESS, "GetFootprint unexpectedly succeeded over HTTP")
      
      result.status = TestCaseResultStatus.SUCCESS;
      return result;
    }
  ),

  /**
   * Test Case 12: Send Asynchronous PCF Request
   */
  SendAsyncPCFRequest: createTest(
    "Test Case 12: Send Asynchronous PCF Request",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-12-send-pcf-creation-request-async",
    async (ctx: TestContext) => {
      const headers = { ...ctx.headers, "Content-Type": "application/cloudevents+json; charset=UTF-8" };

      const body = JSON.stringify({
        specversion: "1.0",
        id: ctx.testRunId + "-12",
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV3.CREATED,
        data: {
          productId: ctx.filterParams.productIds,
          comment: "Please send PCF data for this year.",
        },
      });

      const url = `${ctx.baseUrl}/3/events`;
      const response = await makeRequest(url, "POST", headers, body);

      assertStatus(response.status, 200);

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 13: Received Request Fulfilled Response (Callback)
   */
  ReceivedRequestFulfilledResponse: createTest(
    "Test Case 13: Received Request Fulfilled Response",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-13-call-back-with-a-request-fulfilled-event",
    async () => {
      return {
        status: TestCaseResultStatus.PENDING,
        errorMessage: "Waiting for callback",
      };
    }
  ),

  /**
   * Test Case 14.A: Send Asynchronous Request to be Rejected
   */
  testCase14A_SendAsyncRequestToBeRejected: createTest(
    "Test Case 14.A: Send Asynchronous Request to be Rejected",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14a-request-for-the-creation-of-a-pcf-to-be-rejected",
    async (ctx: TestContext) => {
      const headers = { ...ctx.headers, "Content-Type": "application/cloudevents+json; charset=UTF-8" };

      const body = JSON.stringify({
        specversion: "1.0",
        id: ctx.testRunId + "-14.A",
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV3.CREATED,
        data: {
          productId: ["urn:pact:null"],
          comment: "Please send PCF data for this year.",
        },
      });

      const url = `${ctx.baseUrl}/3/events`;
      const response = await makeRequest(url, "POST", headers, body);

      assertStatus(response.status, 200);

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 14.B: Handle Rejected PCF Request (Callback)
   */
  testCase14B_HandleRejectedPCFRequest: createTest(
    "Test Case 14.B: Handle Rejected PCF Request",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14b-call-back-with-a-request-rejected-event",
    async () => {
      return {
        status: TestCaseResultStatus.PENDING,
        errorMessage: "Waiting for callback",
      };
    }
  ),

  /**
   * Test Case 15: Receive Notification of PCF Update (Published Event)
   */
  ReceiveNotificationOfPCFUpdate: createTest(
    "Test Case 15: Receive Notification of PCF Update (Published Event)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-15-receive-notification-of-pcf-update-published-event",
    async (ctx: TestContext) => {
      const headers = { ...ctx.headers, "Content-Type": "application/cloudevents+json; charset=UTF-8" };

      const body = JSON.stringify({
        type: EventTypesV3.PUBLISHED,
        specversion: "1.0",
        id: randomUUID(),
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      });

      const url = `${ctx.baseUrl}/3/events`;
      const response = await makeRequest(url, "POST", headers, body);

      assertStatus(response.status, 200);

      return { apiResponse: response.text };
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
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      };

      const body = JSON.stringify({
        type: EventTypesV3.PUBLISHED,
        specversion: "1.0",
        id: ctx.testRunId + "-16",
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      });

      const url = `${ctx.baseUrl}/3/events`;
      const response = await makeRequest(url, "POST", headers, body);

      assertStatus(response.status, [400, 401]);

      if (response.data?.code !== "BadRequest") {
        logger.warn(
          `Test case "Test Case 16: Attempt Action Events with Invalid Token": Expected error code BadRequest but received ${response.data?.code}`
        );
      }

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 17: Attempt Action Events through HTTP (non-HTTPS)
   */
  ActionEventsThroughHTTP: createTest(
    "Test Case 17: Attempt Action Events through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-17-attempt-action-events-through-http-non-https",
    async (ctx: TestContext) => {

      const copy = { ...ctx, baseUrl: ctx.baseUrl.replace("https", "http") }
      const result: TestResult = await V3Tests.ReceiveNotificationOfPCFUpdate(copy)
      assert(result.status !== TestCaseResultStatus.SUCCESS, "Action Events unexpectedly succeeded over HTTP")
      
      result.status = TestCaseResultStatus.SUCCESS;
      return result;
    }
  ),

  /**
   * Test Case 18: OpenId Connect-based Authentication Flow
   */
  OpenIdConnectAuthenticationFlow: createTest(
    "Test Case 18: OpenId Connect-based Authentication Flow",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-18-openid-connect-based-authentication-flow",
    async (ctx: TestContext) => {
      if (ctx.authTokenUrl.startsWith(ctx.baseUrl)) {
        return {
          status: TestCaseResultStatus.PENDING,
          errorMessage: "Skipped: authTokenUrl is under baseUrl, not an external OpenID provider",
        };
      }

      const headers = {
        ...getCorrectAuthHeaders(ctx.baseUrl, ctx.clientId, ctx.clientSecret),
      };

      const response = await makeRequest(
        ctx.authTokenUrl,
        "POST",
        headers,
        ctx.authRequestData
      );

      assertStatus(response.status, 200);

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 19: OpenId Connect-based authentication flow with incorrect credentials
   */
  OpenIdConnectAuthFlowWithIncorrectCredentials: createTest(
    "Test Case 19: OpenId connect-based authentication flow with incorrect credentials",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-19-openid-connect-based-authentication-flow-with-incorrect-credentials",
    async (ctx: TestContext) => {
      if (ctx.authTokenUrl.startsWith(ctx.baseUrl)) {
        return {
          status: TestCaseResultStatus.PENDING,
          errorMessage: "Skipped: authTokenUrl is under baseUrl, not an external OpenID provider",
        };
      }

      const headers = {
        ...getIncorrectAuthHeaders(ctx.baseUrl),
      };

      const response = await makeRequest(
        ctx.authTokenUrl,
        "POST",
        headers,
        ctx.authRequestData
      );

      assertStatus(response.status, [400, 401]);

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 20: Filter by ProductId
   */
  FilterByProductId: createTest(
    "Test Case 20: V3 Filtering Functionality: Get Filtered List of Footprints by \"productId\" parameter",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-20-v3-filtering-functionality-get-filtered-list-of-footprints-by-productid-parameter",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?productId=${ctx.filterParams.productId}`;
      const response = await makeRequest(url, "GET", ctx.headers);

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.simpleListFootprintResponse);

      const allMatch = response.data?.data?.every((footprint: { productIds: string[] }) =>
        footprint.productIds.includes(ctx.filterParams.productId)
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the condition: 'productIds contains ${ctx.filterParams.productId}'`
      );

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 21: Filter by CompanyId
   */
  FilterByCompanyId: createTest(
    "Test Case 21: V3 Filtering Functionality: Get Filtered List of Footprints by \"companyId\" parameter",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-21-v3-filtering-functionality-get-filtered-list-of-footprints-by-companyid-parameter",
    async (ctx: TestContext) => {

      const url = `${ctx.baseUrl}/3/footprints?companyId=${ctx.filterParams.companyId}`;
      const response = await makeRequest(url, "GET", ctx.headers);

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.simpleListFootprintResponse);

      const allMatch = response.data?.data?.every((footprint: { companyIds: string[] }) =>
        footprint.companyIds.includes(ctx.filterParams.companyId)
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the condition: 'companyIds contains ${ctx.filterParams.companyId}'`
      );

      return { apiResponse: response.text };
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
      const response = await makeRequest(url, "GET", ctx.headers);

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.emptyResponse);

      assert(
        response.data?.data?.length === 0,
        "Expected empty data array for bogus productId filter"
      );

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 40: Failed Published Event - Malformed Request
   */
  FailedPublishedEventMalformedRequest: createTest(
    "Test Case 40: Failed to Receive Notification of PCF Update (Published Event) - Malformed Request",
    "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-40-failed-to-receive-notification-of-pcf-update-published-event-malformed-request",
    async (ctx: TestContext) => {
      const headers = { ...ctx.headers, "Content-Type": "application/cloudevents+json; charset=UTF-8" };

      const body = JSON.stringify({
        type: EventTypesV3.PUBLISHED,
        specversion: "1.0",
        id: randomUUID(),
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["urn:gtin:4712345060507"],
        },
      });

      const url = `${ctx.baseUrl}/3/events`;
      const response = await makeRequest(url, "POST", headers, body);

      assertStatus(response.status, 400);

      return { apiResponse: response.text };
    }
  ),
};
