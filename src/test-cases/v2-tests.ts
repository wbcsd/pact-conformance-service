import { randomUUID } from "crypto";
import { EventTypesV2 } from "../services/types";
import { randomString, getCorrectAuthHeaders, getIncorrectAuthHeaders, getAccessToken, fetchOpenIdTokenEndpoint } from "../utils/authUtils";
import { TestContext, createTest, assert, assertStatus, assertSchema, createListenerTest, ListenerContext, createInitTest } from "./test-helpers";
import { parseLinkHeader } from "../utils/fetchFootprints";

export const V2Tests = {
  /**
   * Test Case 0: Initialize test run
   */
  InitializeTestRun: createInitTest(
    "Test Case 0: Initialize test run",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-0-initialize-test-run",
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
      const footprintsResponse = await ctx.request(`${ctx.baseUrl}/2/footprints`, "GET")
      ctx.footprints = footprintsResponse.data?.data
      assert(ctx.footprints?.length >= 2, "At least two footprints are required to run the tests, but none were returned from the API");
    
      // Get link header for pagination test case 5
      const paginationResponse = await ctx.request(`${ctx.baseUrl}/2/footprints?limit=1`, "GET")
      ctx.paginationLinks = parseLinkHeader(paginationResponse.headers["link"])
      
      // Store productIds on the test run data for use in callback test cases
      assert(ctx.footprints[0].productIds?.length > 0, "Footprints must contain at least one product ID");    
      ctx.testRun.data = { productIds: ctx.footprints[0].productIds }

      
      ctx.info("Test context initialized");
    }
  ),

  /**
   * Test Case 1: Obtain auth token with valid credentials
   */
  ObtainAuthTokenWithValidCredentials: createTest(
    "Test Case 1: Obtain auth token with valid credentials",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-1-obtain-auth-token-with-valid-credentials",
    async (ctx: TestContext) => {
      const headers = {
        ...getCorrectAuthHeaders(ctx.baseUrl, ctx.startParams.clientId, ctx.startParams.clientSecret)
      }

      const response = await ctx.request(ctx.authTokenUrl, "POST", headers, ctx.authRequestData)
      assertStatus(response.status, 200)
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
      const response = await ctx.request(ctx.authTokenUrl, "POST", headers, ctx.authRequestData)
      assertStatus(response.status, [400, 401])
    }
  ),

  /**
   * Test Case 3: Get PCF using GetFootprint
   */
  GetPCFUsingGetFootprint: createTest(
    "Test Case 3: Get PCF using GetFootprint",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-3-get-pcf-using-getfootprint",
    async (ctx: TestContext) => {
      const footprintId = ctx.footprints[0]?.id;
      const url = `${ctx.baseUrl}/2/footprints/${footprintId}`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, 200);
      assert(!!response.data, "Expected JSON response body, but got none");
      assertSchema(response.data, ctx.schema.getFootprintResponse);

      assert(
        response.data?.data?.id === footprintId,
        `Returned footprint does not match the requested footprint with id ${footprintId}`
      );
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-5-pagination-link-implementation-of-action-listfootprints",
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-6-attempt-listfootprints-with-invalid-token",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      };
      const url = `${ctx.baseUrl}/2/footprints`;
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-7-attempt-getfootprint-with-invalid-token",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      };
      const footprintId = ctx.footprints[0]?.id;
      const url = `${ctx.baseUrl}/2/footprints/${footprintId}`;
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-8-attempt-getfootprint-with-non-existent-pfid",
    async (ctx: TestContext) => {
      const url = `${ctx.baseUrl}/2/footprints/00000000-0000-0000-0000-000000000000`;
      const response = await ctx.request(url, "GET");

      assertStatus(response.status, [400, 404]);
      assert(
        response.data?.code === "NoSuchFootprint" || response.data?.code === "BadRequest",
        "Expected error code NoSuchFootprint or BadRequest in response"
      );
    }
  ),

  /**
   * Test Case 9: Attempt Authentication through HTTP (non-HTTPS)
   */
  AuthenticationThroughHTTP: createTest(
    "Test Case 9: Attempt Authentication through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-9-attempt-authentication-through-http-non-https",
    async (ctx: TestContext) => {
      const old = ctx.authTokenUrl;
      ctx.authTokenUrl = ctx.authTokenUrl.replace("https", "http");
      let threw = false;
      try { await V2Tests.ObtainAuthTokenWithValidCredentials.action!(ctx); } catch { threw = true; }
      ctx.authTokenUrl = old;
      assert(threw, "Auth token request unexpectedly succeeded over HTTP");
    }
  ),

  /**
   * Test Case 10: Attempt ListFootprints through HTTP (non-HTTPS)
   */
  ListFootprintsThroughHTTP: createTest(
    "Test Case 10: Attempt ListFootprints through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-10-attempt-listfootprints-through-http-non-https",
    async (ctx: TestContext) => {
      const old = ctx.baseUrl;
      ctx.baseUrl = ctx.baseUrl.replace("https", "http");
      let threw = false;
      try { await V2Tests.GetAllPCFsUsingListFootprints.action!(ctx); } catch { threw = true; }
      ctx.baseUrl = old;
      assert(threw, "ListFootprints unexpectedly succeeded over HTTP");
    }
  ),

  /**
   * Test Case 11: Attempt GetFootprint through HTTP (non-HTTPS)
   */
  GetFootprintThroughHTTP: createTest(
    "Test Case 11: Attempt GetFootprint through HTTP (non-HTTPS)",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-11-attempt-getfootprint-through-http-non-https",
    async (ctx: TestContext) => {
      const old = ctx.baseUrl;
      ctx.baseUrl = ctx.baseUrl.replace("https", "http");
      let threw = false;
      try { await V2Tests.GetPCFUsingGetFootprint.action!(ctx); } catch { threw = true; }
      ctx.baseUrl = old;
      assert(threw, "GetFootprint unexpectedly succeeded over HTTP");
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

      const body = {
        specversion: "1.0",
        id: ctx.testRun.testRunId + "/13", // Indicate the callback test case
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV2.CREATED,
        data: {
          pf: {
            productIds: ctx.footprints[0].productIds,
          },
          comment: "Please send PCF data for this year.",
        },
      };

      const url = `${ctx.baseUrl}/2/events`;
      ctx.info(`Sending asynchronous PCF request to ${url} with id: ${body.id} and productIds: ${ctx.footprints[0].productIds} - this should trigger a callback with a request fulfilled event`);

      const response = await ctx.request(url, "POST", headers, body);

      assertStatus(response.status, 200);
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-14a-request-for-the-creation-of-a-pcf-to-be-rejected",
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
        type: EventTypesV2.CREATED,
        data: {
          pf: {
            productIds: ["urn:pact:null"],
          },
          comment: "Please send PCF data for this year.",
        },
      };

      const url = `${ctx.baseUrl}/2/events`;
      const response = await ctx.request(url, "POST", headers, body);

      assertStatus(response.status, 200);
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-15-receive-notification-of-pcf-update-published-event",
    async (ctx: TestContext) => {
      const headers = {
        ...ctx.headers,
        "Content-Type": "application/cloudevents+json; charset=UTF-8"
      };

      const body = {
        type: EventTypesV2.PUBLISHED,
        specversion: "1.0",
        id: randomUUID(),
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      };

      const url = `${ctx.baseUrl}/2/events`;
      const response = await ctx.request(url, "POST", headers, body);

      assertStatus(response.status, 200);
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

      const body = {
        type: EventTypesV2.PUBLISHED,
        specversion: "1.0",
        id: ctx.testRun.testRunId + "/16",
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      };

      const url = `${ctx.baseUrl}/2/events`;
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-17-attempt-action-events-through-http-non-https",
    async (ctx: TestContext) => {

      const old = ctx.baseUrl;
      ctx.baseUrl = ctx.baseUrl.replace("https", "http");
      let threw = false;
      try { await V2Tests.ReceiveNotificationOfPCFUpdate.action!(ctx); } catch { threw = true; }
      ctx.baseUrl = old;
      assert(threw, "Action Events unexpectedly succeeded over HTTP");
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
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-19-openid-connect-based-authentication-flow-with-incorrect-credentials",
    async (ctx: TestContext) => {
      const headers = {
        ...getIncorrectAuthHeaders(ctx.baseUrl),
      };
      const response = await ctx.request(ctx.authTokenUrl, "POST", headers, ctx.authRequestData);
      assertStatus(response.status, [400, 401]);
    }
  ),

  GetFilteredListOfFootprints: createTest(
    "Test Case 20: Get Filtered List of Footprints",
    "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-20-get-filtered-list-of-footprints",
    async (ctx: TestContext) => {
      const created = ctx.footprints[0]?.created;
      const filterValue = encodeURIComponent(`created ge '${created}'`);
      const url = `${ctx.baseUrl}/2/footprints?$filter=${filterValue}`;
      const response = await ctx.request(url, "GET");

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

      const body = {
        type: EventTypesV2.PUBLISHED,
        specversion: "1.0",
        id: randomUUID(),
        source: ctx.webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["urn:gtin:4712345060507"],
        },
      };

      const url = `${ctx.baseUrl}/2/events`;
      const response = await ctx.request(url, "POST", headers, body);

      assertStatus(response.status, 400);
    }
  ),
};
