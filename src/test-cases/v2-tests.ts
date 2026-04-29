import { randomUUID } from "crypto";
import logger from "../utils/logger";
import { EventTypesV2, TestResult, TestCaseResultStatus } from "../services/types";
import { randomString, getCorrectAuthHeaders, getIncorrectAuthHeaders } from "../utils/authUtils";
import { TestContext, createTest, assert, assertStatus, assertSchema, makeRequest, createListenerTest, ListenerContext } from "./test-helpers";

export const V2Tests = {
  /**
   * Test Case 1: Obtain auth token with valid credentials
   */
  ObtainAuthTokenWithValidCredentials: createTest(
    "Test Case 1: Obtain auth token with valid credentials",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-1-obtain-auth-token-with-valid-credentials",
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-2-obtain-auth-token-with-invalid-credentials",
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-3-get-pcf-using-getfootprint",
    async (ctx: TestContext) => {
      const footprintId = ctx.footprints.data[0]?.id;
      const url = `${ctx.baseUrl}/2/footprints/${footprintId}`;
      const response = await makeRequest(url, "GET", ctx.headers);

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");
      assertSchema(response.data, ctx.schema.getFootprintResponse);

      assert(
        response.data?.data?.id === footprintId,
        `Returned footprint does not match the requested footprint with id ${footprintId}`
      );

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 4: Get all PCFs using ListFootprints
   */
  GetAllPCFsUsingListFootprints: createTest(
    "Test Case 4: Get all PCFs using ListFootprints",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-4-get-all-pcfs-using-listfootprints",
    async (ctx: TestContext) => {
      const url = `${ctx.baseUrl}/2/footprints`;
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-5-pagination-link-implementation-of-action-listfootprints",
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-6-attempt-listfootprints-with-invalid-token",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      };
      const url = `${ctx.baseUrl}/2/footprints`;
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-7-attempt-getfootprint-with-invalid-token",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      };
      const footprintId = ctx.footprints.data[0]?.id;
      const url = `${ctx.baseUrl}/2/footprints/${footprintId}`;
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-8-attempt-getfootprint-with-non-existent-pfid",
    async (ctx: TestContext) => {
      const url = `${ctx.baseUrl}/2/footprints/00000000-0000-0000-0000-000000000000`;
      const response = await makeRequest(url, "GET", ctx.headers);

      assertStatus(response.status, [400, 404]);
      assert(
        response.data?.code === "NoSuchFootprint" || response.data?.code === "BadRequest",
        "Expected error code NoSuchFootprint or BadRequest in response"
      );

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 9: Attempt Authentication through HTTP (non-HTTPS)
   */
  AuthenticationThroughHTTP: createTest(
    "Test Case 9: Attempt Authentication through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-9-attempt-authentication-through-http-non-https",
    async (ctx: TestContext) => {

      const copy = { ...ctx, authTokenUrl: ctx.authTokenUrl.replace("https", "http") }
      const result: TestResult = await V2Tests.ObtainAuthTokenWithValidCredentials.action(copy)
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-10-attempt-listfootprints-through-http-non-https",
    async (ctx: TestContext) => {

      const copy = { ...ctx, baseUrl: ctx.baseUrl.replace("https", "http") }
      const result: TestResult = await V2Tests.GetAllPCFsUsingListFootprints.action(copy)
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-11-attempt-getfootprint-through-http-non-https",
    async (ctx: TestContext) => {

      const copy = { ...ctx, baseUrl: ctx.baseUrl.replace("https", "http") }
      const result: TestResult = await V2Tests.GetPCFUsingGetFootprint.action(copy)
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-12-send-pcf-creation-request-async",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        "Content-Type": "application/cloudevents+json; charset=UTF-8"
      };

      const body = JSON.stringify({
        specversion: "1.0",
        id: ctx.testRunId + "/13", // Indicate the callback test case
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV2.CREATED,
        data: {
          pf: {
            productIds: ctx.footprints.data[0].productIds,
          },
          comment: "Please send PCF data for this year.",
        },
      });

      const url = `${ctx.baseUrl}/2/events`;
      const response = await makeRequest(url, "POST", headers, body);

      assertStatus(response.status, 200);

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 13: Received Request Fulfilled Response (Callback)
   */
  ReceivedRequestFulfilledResponse: createListenerTest(
    "Test Case 13: Received Request Fulfilled Response",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-13-call-back-with-a-request-fulfilled-event",
    async (ctx) => {
      // This callback will be triggered by the system when it receives the request fulfilled event, and will contain the logic to validate the event payload and update the test result accordingly.
      // The actual processing of the event is handled in the EventHandler service, which will call a separate function to process accepted events (Test Case 13) and rejected events (Test Case 14.B)
      assert(ctx.path === "/2/events", "Callback received on incorrect path");
      assertSchema(ctx.data, ctx.schema.events?.fulfilled);
      const requestedProductIds = (ctx.testRun.data as any).productIds as string[] | undefined;
      for (const pf of ctx.data.pfs) {
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-14a-request-for-the-creation-of-a-pcf-to-be-rejected",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        "Content-Type": "application/cloudevents+json; charset=UTF-8"
      };

      const body = JSON.stringify({
        specversion: "1.0",
        id: ctx.testRunId + "/14.B", // Indicate the callback test case
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV2.CREATED,
        data: {
          pf: {
            productIds: ["urn:pact:null"],
          },
          comment: "Please send PCF data for this year.",
        },
      });

      const url = `${ctx.baseUrl}/2/events`;
      const response = await makeRequest(url, "POST", headers, body);

      assertStatus(response.status, 200);

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 14.B: Handle Rejected PCF Request (Callback)
   */
  testCase14B_HandleRejectedPCFRequest: createListenerTest(
    "Test Case 14.B: Handle Rejected PCF Request",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-14b-call-back-with-a-request-rejected-event",
    async (ctx: ListenerContext) => {
      assert(ctx.path === "/2/events", `Invalid request path: expected /2/events, but received ${ctx.path}`);
      assertSchema(ctx.data, ctx.schema.events?.rejected);
      assert(
        ctx.data?.error?.code && ctx.data?.error?.message,
        "Rejected event must contain an error object with a code and message"
      );
    }
  ),

  /**
   * Test Case 15: Receive Notification of PCF Update (Published Event)
   */
  ReceiveNotificationOfPCFUpdate: createTest(
    "Test Case 15: Receive Notification of PCF Update (Published Event)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-15-receive-notification-of-pcf-update-published-event",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        "Content-Type": "application/cloudevents+json; charset=UTF-8"
      };

      const body = JSON.stringify({
        type: EventTypesV2.PUBLISHED,
        specversion: "1.0",
        id: randomUUID(),
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      });

      const url = `${ctx.baseUrl}/2/events`;
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-16-attempt-action-events-with-invalid-token",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      };

      const body = JSON.stringify({
        type: EventTypesV2.PUBLISHED,
        specversion: "1.0",
        id: ctx.testRunId + "/16",
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      });

      const url = `${ctx.baseUrl}/2/events`;
      const response = await makeRequest(url, "POST", headers, body);

      assertStatus(response.status, [400, 401]);
      assert(response.data?.code === "BadRequest", "Expected error code BadRequest in response");

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 17: Attempt Action Events through HTTP (non-HTTPS)
   */
  ActionEventsThroughHTTP: createTest(
    "Test Case 17: Attempt Action Events through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-17-attempt-action-events-through-http-non-https",
    async (ctx: TestContext) => {

      const copy = { ...ctx, baseUrl: ctx.baseUrl.replace("https", "http") }
      const result: TestResult = await V2Tests.ReceiveNotificationOfPCFUpdate.action(copy)
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-18-openid-connect-based-authentication-flow",
    async (ctx: TestContext) => {
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-19-openid-connect-based-authentication-flow-with-incorrect-credentials",
    async (ctx: TestContext) => {
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

  GetFilteredListOfFootprints: createTest(
    "Test Case 20: Get Filtered List of Footprints",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-20-get-filtered-list-of-footprints",
    async (ctx: TestContext) => {
      const created = ctx.footprints.data[0]?.created;
      const filterValue = encodeURIComponent(`created ge '${created}'`);
      const url = `${ctx.baseUrl}/2/footprints?$filter=${filterValue}`;
      const response = await makeRequest(url, "GET", ctx.headers);

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");

      assertSchema(response.data, ctx.schema.simpleListFootprintResponse);

      const allMatch = response.data?.data?.every(
        (footprint: { created: Date }) => footprint.created >= created
      );
      assert(
        !!allMatch,
        `One or more footprints do not match the condition: 'created date >= ${created}'`
      );

      return { apiResponse: response.text };
    }
  ),

  /**
   * Test Case 40: Failed Published Event - Malformed Request
   */
  FailedPublishedEventMalformedRequest: createTest(
    "Test Case 21: Failed to Receive Notification of PCF Update (Published Event) - Malformed Request",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-21-failed-to-receive-notification-of-pcf-update-published-event-malformed-request",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      };

      const body = JSON.stringify({
        type: EventTypesV2.PUBLISHED,
        specversion: "1.0",
        id: randomUUID(),
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["urn:gtin:4712345060507"],
        },
      });

      const url = `${ctx.baseUrl}/2/events`;
      const response = await makeRequest(url, "POST", headers, body);

      assertStatus(response.status, 400);

      return { apiResponse: response.text };
    }
  ),
};
