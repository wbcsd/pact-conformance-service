import Ajv from "ajv";
import addFormats from "ajv-formats";
import betterErrors from "ajv-errors";
import { randomUUID } from "crypto";
import { TestResult, TestCaseResultStatus, ApiVersion, EventTypesV3 } from "../services/types";
import config from "../config";
import logger from "../utils/logger";
import { randomString, getCorrectAuthHeaders, getIncorrectAuthHeaders } from "../utils/authUtils";
import { getSchema } from "../schemas";

/**
 * Test context containing all parameters needed for test execution
 */
export interface V3TestContext {
  testRunId: string;
  baseUrl: string;
  authTokenUrl: string;
  accessToken: string;
  clientId: string;
  clientSecret: string;
  authRequestData: string;
  version: ApiVersion;
  webhookUrl: string;
  footprints: any;
  paginationLinks: Record<string, string>;
  schema: any;
  filterParams: any;
}

/**
 * Helper to validate JSON schema
 */
const validateSchema = (data: any, schema: any): { valid: boolean; errors?: string } => {
  if (!schema) return { valid: true };

  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  betterErrors(ajv);
  const validate = ajv.compile(schema);

  if (!validate(data)) {
    return {
      valid: false,
      errors: validate.errors?.map((e) => e.message).join(", "),
    };
  }

  return { valid: true };
};

/**
 * Helper to make HTTP requests
 */
const makeRequest = async (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ status: number; data: any; text: string; error?: string }> => {
  try {
    const response = await fetch(url, {
      method,
      body,
      headers,
      signal: AbortSignal.timeout(config.TESTCASE_TIMEOUT),
    });

    const text = await response.text();
    let data = null;

    if (text && response.headers.get("Content-Type")?.includes("application/json")) {
      data = JSON.parse(text);
    }

    return { status: response.status, data, text };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return {
        status: 0,
        data: null,
        text: "",
        error: `Request timeout after ${config.TESTCASE_TIMEOUT}ms`,
      };
    }
    return {
      status: 0,
      data: null,
      text: "",
      error: error.message,
    };
  }
};

/**
 * V3Tests object with imperative test functions
 * Each test contains the actual execution logic: HTTP calls, status checks, schema validation, etc.
 */
export const V3Tests = {
  /**
   * Test Case 1: Obtain auth token with valid credentials
   */
  testCase1_ObtainAuthTokenWithValidCredentials: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 1: Obtain auth token with valid credentials",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#1",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-1-obtain-auth-token-with-valid-credentials",
    };

    const headers = {
      ...getCorrectAuthHeaders(ctx.baseUrl, ctx.clientId, ctx.clientSecret),
    };

    const response = await makeRequest(
      ctx.authTokenUrl,
      "POST",
      headers,
      ctx.authRequestData
    );

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 200, but got ${response.status}`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 2: Obtain auth token with invalid credentials
   */
  testCase2_ObtainAuthTokenWithInvalidCredentials: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 2: Obtain auth token with invalid credentials",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#2",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-2-obtain-auth-token-with-invalid-credentials",
    };

    const headers = {
      ...getIncorrectAuthHeaders(ctx.baseUrl),
    };

    const response = await makeRequest(
      ctx.authTokenUrl,
      "POST",
      headers,
      ctx.authRequestData
    );

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (![400, 401].includes(response.status)) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status [400, 401], but got ${response.status}`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 3: Get PCF using GetFootprint
   */
  testCase3_GetPCFUsingGetFootprint: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 3: Get PCF using GetFootprint",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#3",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-3-get-pcf-using-getfootprint",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

    const url = `${ctx.baseUrl}/3/footprints/${ctx.filterParams.id}`;
    const response = await makeRequest(url, "GET", headers);

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 200, but got ${response.status}`;
      return result;
    }

    if (!response.data) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Expected JSON response body, but got none";
      return result;
    }

    // Validate schema
    const schemaValidation = validateSchema(response.data, ctx.schema.getFootprintResponse);
    if (!schemaValidation.valid) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Schema validation failed: ${schemaValidation.errors}`;
      return result;
    }

    // Validate that returned footprint matches the requested ID
    if (response.data?.data?.id !== ctx.filterParams.id) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Returned footprint does not match the requested footprint with id ${ctx.filterParams.id}`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 4: Get all PCFs using ListFootprints
   */
  testCase4_GetAllPCFsUsingListFootprints: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 4: Get all PCFs using ListFootprints",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#4",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-4-get-all-pcfs-using-listfootprints",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

    const url = `${ctx.baseUrl}/3/footprints`;
    const response = await makeRequest(url, "GET", headers);

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (![200, 202].includes(response.status)) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status [200, 202], but got ${response.status}`;
      return result;
    }

    if (!response.data) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Expected JSON response body, but got none";
      return result;
    }

    // Validate schema
    const schemaValidation = validateSchema(response.data, ctx.schema.listFootprintResponse);
    if (!schemaValidation.valid) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Schema validation failed: ${schemaValidation.errors}`;
      return result;
    }

    // Verify footprint count matches
    if (response.data?.data?.length !== ctx.footprints.data.length) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Number of footprints does not match";
      return result;
    }

    return result;
  },

  /**
   * Test Case 5: Pagination link implementation
   */
  testCase5_PaginationLinkImplementation: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 5: Pagination link implementation of Action ListFootprints",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#5",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-5-pagination-link-implementation-of-action-listfootprints",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

    const paginationUrl = Object.values(ctx.paginationLinks)[0];
    if (!paginationUrl) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "No pagination link found";
      return result;
    }

    const response = await makeRequest(paginationUrl, "GET", headers);

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 200, but got ${response.status}`;
      return result;
    }

    if (!response.data) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Expected JSON response body, but got none";
      return result;
    }

    // Validate schema
    const schemaValidation = validateSchema(response.data, ctx.schema.simpleListFootprintResponse);
    if (!schemaValidation.valid) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Schema validation failed: ${schemaValidation.errors}`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 6: Attempt ListFootprints with Invalid Token
   */
  testCase6_ListFootprintsWithInvalidToken: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 6: Attempt ListFootPrints with Invalid Token",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#6",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-6-attempt-listfootprints-with-invalid-token",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
    };

    const url = `${ctx.baseUrl}/3/footprints`;
    const response = await makeRequest(url, "GET", headers);

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (![400, 401].includes(response.status)) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status [400, 401], but got ${response.status}`;
      return result;
    }

    if (response.data?.code !== "BadRequest") {
      logger.warn(
        `Test case "${result.name}": Expected error code BadRequest but received ${response.data?.code}`
      );
    }

    return result;
  },

  /**
   * Test Case 7: Attempt GetFootprint with Invalid Token
   */
  testCase7_GetFootprintWithInvalidToken: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 7: Attempt GetFootprint with Invalid Token",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#7",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-7-attempt-getfootprint-with-invalid-token",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
    };

    const url = `${ctx.baseUrl}/3/footprints/${ctx.filterParams.id}`;
    const response = await makeRequest(url, "GET", headers);

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (![400, 401].includes(response.status)) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status [400, 401], but got ${response.status}`;
      return result;
    }

    if (response.data?.code !== "BadRequest") {
      logger.warn(
        `Test case "${result.name}": Expected error code BadRequest but received ${response.data?.code}`
      );
    }

    return result;
  },

  /**
   * Test Case 8: Attempt GetFootprint with Non-Existent PfId
   */
  testCase8_GetFootprintWithNonExistentId: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 8: Attempt GetFootprint with Non-Existent PfId",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#8",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-8-attempt-getfootprint-with-non-existent-pfid",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

    const url = `${ctx.baseUrl}/3/footprints/random-string-as-id-${randomString(16)}`;
    const response = await makeRequest(url, "GET", headers);

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (![400, 404].includes(response.status)) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status [400, 404], but got ${response.status}`;
      return result;
    }

    if (response.data?.code !== "NotFound") {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected error code NotFound in response`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 9: Attempt Authentication through HTTP (non-HTTPS)
   */
  testCase9_AuthenticationThroughHTTP: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 9: Attempt Authentication through HTTP (non-HTTPS)",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#9",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-9-attempt-authentication-through-http-non-https",
    };

    const headers = {
      ...getCorrectAuthHeaders(ctx.baseUrl, ctx.clientId, ctx.clientSecret),
    };

    const httpUrl = ctx.authTokenUrl.replace("https", "http");
    const response = await makeRequest(httpUrl, "POST", headers, ctx.authRequestData);

    result.apiResponse = response.text;

    // This test expects HTTP to fail, so a successful connection would be a failure
    if (!response.error && response.status === 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Expected failure when using HTTP, but request succeeded";
      return result;
    }

    // If there was an error or non-200 status, that's the expected behavior
    result.errorMessage = "Successfully tested for failure<br/>Expected error occurred<br/>";
    return result;
  },

  /**
   * Test Case 10: Attempt ListFootprints through HTTP (non-HTTPS)
   */
  testCase10_ListFootprintsThroughHTTP: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 10: Attempt ListFootprints through HTTP (non-HTTPS)",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#10",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-10-attempt-listfootprints-through-http-non-https",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

    const httpUrl = `${ctx.baseUrl.replace("https", "http")}/3/footprints`;
    const response = await makeRequest(httpUrl, "GET", headers);

    result.apiResponse = response.text;

    // This test expects HTTP to fail
    if (!response.error && [200, 202].includes(response.status)) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Expected failure when using HTTP, but request succeeded";
      return result;
    }

    result.errorMessage = "Successfully tested for failure<br/>Expected error occurred<br/>";
    return result;
  },

  /**
   * Test Case 11: Attempt GetFootprint through HTTP (non-HTTPS)
   */
  testCase11_GetFootprintThroughHTTP: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 11: Attempt GetFootprint through HTTP (non-HTTPS)",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#11",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-11-attempt-getfootprint-through-http-non-https",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

    const httpUrl = `${ctx.baseUrl.replace("https", "http")}/3/footprints/${ctx.filterParams.id}`;
    const response = await makeRequest(httpUrl, "GET", headers);

    result.apiResponse = response.text;

    // This test expects HTTP to fail
    if (!response.error && response.status === 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Expected failure when using HTTP, but request succeeded";
      return result;
    }

    result.errorMessage = "Successfully tested for failure<br/>Expected error occurred<br/>";
    return result;
  },

  /**
   * Test Case 12: Send Asynchronous PCF Request
   */
  testCase12_SendAsyncPCFRequest: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 12: Send Asynchronous PCF Request",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#12",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-12-send-pcf-creation-request-async",
    };

    const headers = {
      "Content-Type": "application/cloudevents+json; charset=UTF-8",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

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

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 200, but got ${response.status}`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 13: Received Request Fulfilled Response (Callback)
   */
  testCase13_ReceivedRequestFulfilledResponse: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 13: Received Request Fulfilled Response",
      status: TestCaseResultStatus.PENDING,
      mandatory: true,
      testKey: "TESTCASE#13",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-13-call-back-with-a-request-fulfilled-event",
    };

    // This is a callback test - the API will call us back
    // We return PENDING and the event handler will update the result
    return result;
  },

  /**
   * Test Case 14.A: Send Asynchronous Request to be Rejected
   */
  testCase14A_SendAsyncRequestToBeRejected: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 14.A: Send Asynchronous Request to be Rejected",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#14.A",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14a-request-for-the-creation-of-a-pcf-to-be-rejected",
    };

    const headers = {
      "Content-Type": "application/cloudevents+json; charset=UTF-8",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

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

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 200, but got ${response.status}`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 14.B: Handle Rejected PCF Request (Callback)
   */
  testCase14B_HandleRejectedPCFRequest: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 14.B: Handle Rejected PCF Request",
      status: TestCaseResultStatus.PENDING,
      mandatory: true,
      testKey: "TESTCASE#14.B",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14b-call-back-with-a-request-rejected-event",
    };

    // This is a callback test - the API will call us back with a rejection event
    return result;
  },

  /**
   * Test Case 15: Receive Notification of PCF Update (Published Event)
   */
  testCase15_ReceiveNotificationOfPCFUpdate: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 15: Receive Notification of PCF Update (Published Event)",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#15",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-15-receive-notification-of-pcf-update-published-event",
    };

    const headers = {
      "Content-Type": "application/cloudevents+json; charset=UTF-8",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

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

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 200, but got ${response.status}`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 16: Attempt Action Events with Invalid Token
   */
  testCase16_ActionEventsWithInvalidToken: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 16: Attempt Action Events with Invalid Token",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#16",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-16-attempt-action-events-with-invalid-token",
    };

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

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (![400, 401].includes(response.status)) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status [400, 401], but got ${response.status}`;
      return result;
    }

    if (response.data?.code !== "BadRequest") {
      logger.warn(
        `Test case "${result.name}": Expected error code BadRequest but received ${response.data?.code}`
      );
    }

    return result;
  },

  /**
   * Test Case 17: Attempt Action Events through HTTP (non-HTTPS)
   */
  testCase17_ActionEventsThroughHTTP: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 17: Attempt Action Events through HTTP (non-HTTPS)",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#17",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-17-attempt-action-events-through-http-non-https",
    };

    const headers = {
      "Content-Type": "application/cloudevents+json; charset=UTF-8",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

    const body = JSON.stringify({
      specversion: "1.0",
      id: ctx.testRunId + "-17",
      source: ctx.webhookUrl,
      time: new Date().toISOString(),
      type: EventTypesV3.PUBLISHED,
      data: {
        pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
      },
    });

    const httpUrl = `${ctx.baseUrl.replace("https", "http")}/3/events`;
    const response = await makeRequest(httpUrl, "POST", headers, body);

    result.apiResponse = response.text;

    // This test expects HTTP to fail
    if (!response.error && response.status === 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Expected failure when using HTTP, but request succeeded";
      return result;
    }

    result.errorMessage = "Successfully tested for failure<br/>Expected error occurred<br/>";
    return result;
  },

  /**
   * Test Case 18: OpenId Connect-based Authentication Flow
   */
  testCase18_OpenIdConnectAuthenticationFlow: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 18: OpenId Connect-based Authentication Flow",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#18",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-18-openid-connect-based-authentication-flow",
    };

    // Skip if authTokenUrl is under the baseUrl (not external OpenID provider)
    if (ctx.authTokenUrl.startsWith(ctx.baseUrl)) {
      result.status = TestCaseResultStatus.PENDING;
      result.errorMessage = "Skipped: authTokenUrl is under baseUrl, not an external OpenID provider";
      return result;
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

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 200, but got ${response.status}`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 19: OpenId Connect-based authentication flow with incorrect credentials
   */
  testCase19_OpenIdConnectAuthFlowWithIncorrectCredentials: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 19: OpenId connect-based authentication flow with incorrect credentials",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#19",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-19-openid-connect-based-authentication-flow-with-incorrect-credentials",
    };

    // Skip if authTokenUrl is under the baseUrl
    if (ctx.authTokenUrl.startsWith(ctx.baseUrl)) {
      result.status = TestCaseResultStatus.PENDING;
      result.errorMessage = "Skipped: authTokenUrl is under baseUrl, not an external OpenID provider";
      return result;
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

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (![400, 401].includes(response.status)) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status [400, 401], but got ${response.status}`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 20: Filter by ProductId
   */
  testCase20_FilterByProductId: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: `Test Case 20: V3 Filtering Functionality: Get Filtered List of Footprints by "productId" parameter`,
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#20",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-20-v3-filtering-functionality-get-filtered-list-of-footprints-by-productid-parameter",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

    const url = `${ctx.baseUrl}/3/footprints?productId=${ctx.filterParams.productId}`;
    const response = await makeRequest(url, "GET", headers);

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 200, but got ${response.status}`;
      return result;
    }

    if (!response.data) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Expected JSON response body, but got none";
      return result;
    }

    // Validate schema
    const schemaValidation = validateSchema(response.data, ctx.schema.simpleListFootprintResponse);
    if (!schemaValidation.valid) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Schema validation failed: ${schemaValidation.errors}`;
      return result;
    }

    // Verify all returned footprints match the filter
    const allMatch = response.data?.data?.every((footprint: { productIds: string[] }) =>
      footprint.productIds.includes(ctx.filterParams.productId)
    );

    if (!allMatch) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `One or more footprints do not match the condition: 'productIds contains ${ctx.filterParams.productId}'`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 21: Filter by CompanyId
   */
  testCase21_FilterByCompanyId: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: `Test Case 21: V3 Filtering Functionality: Get Filtered List of Footprints by "companyId" parameter`,
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#21",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-21-v3-filtering-functionality-get-filtered-list-of-footprints-by-companyid-parameter",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

    const url = `${ctx.baseUrl}/3/footprints?companyId=${ctx.filterParams.companyId}`;
    const response = await makeRequest(url, "GET", headers);

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 200, but got ${response.status}`;
      return result;
    }

    if (!response.data) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Expected JSON response body, but got none";
      return result;
    }

    // Validate schema
    const schemaValidation = validateSchema(response.data, ctx.schema.simpleListFootprintResponse);
    if (!schemaValidation.valid) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Schema validation failed: ${schemaValidation.errors}`;
      return result;
    }

    // Verify all returned footprints match the filter
    const allMatch = response.data?.data?.every((footprint: { companyIds: string[] }) =>
      footprint.companyIds.includes(ctx.filterParams.companyId)
    );

    if (!allMatch) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `One or more footprints do not match the condition: 'companyIds contains ${ctx.filterParams.companyId}'`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 30: Filter by ProductId (Negative)
   */
  testCase30_FilterByProductIdNegative: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: `Test Case 30: V3 Filtering Functionality: Get Filtered List of Footprints by "productId" parameter (negative test case)`,
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#30",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-30-v3-filtering-functionality-get-filtered-list-of-footprints-by-productid-parameter-negative-test-case",
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

    const url = `${ctx.baseUrl}/3/footprints?productId=urn:bogus:product:${randomString(16)}`;
    const response = await makeRequest(url, "GET", headers);

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 200) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 200, but got ${response.status}`;
      return result;
    }

    if (!response.data) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = "Expected JSON response body, but got none";
      return result;
    }

    // Validate schema
    const schemaValidation = validateSchema(response.data, ctx.schema.emptyResponse);
    if (!schemaValidation.valid) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Schema validation failed: ${schemaValidation.errors}`;
      return result;
    }

    // Verify result is empty
    if (response.data?.data?.length !== 0) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected empty data array for bogus productId filter`;
      return result;
    }

    return result;
  },

  /**
   * Test Case 40: Failed Published Event - Malformed Request
   */
  testCase40_FailedPublishedEventMalformedRequest: async (ctx: V3TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: "Test Case 40: Failed to Receive Notification of PCF Update (Published Event) - Malformed Request",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: "TESTCASE#40",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-40-failed-to-receive-notification-of-pcf-update-published-event-malformed-request",
    };

    const headers = {
      "Content-Type": "application/cloudevents+json; charset=UTF-8",
      Authorization: `Bearer ${ctx.accessToken}`,
    };

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

    result.apiResponse = response.text;

    if (response.error) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = response.error;
      return result;
    }

    if (response.status !== 400) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Expected status 400, but got ${response.status}`;
      return result;
    }

    return result;
  },
};
