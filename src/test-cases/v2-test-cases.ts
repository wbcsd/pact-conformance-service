import { ApiVersion, TestCase, EventTypesV2 } from "../services/types";
import { randomUUID } from "crypto";
import { randomString } from "../utils/authUtils";
import {
  v2_0_ResponseSchema,
  v2_0_SingleFootprintResponseSchema,
  v2_1_ResponseSchema,
  v2_1_SingleFootprintResponseSchema,
  v2_2_ResponseSchema,
  v2_2_SingleFootprintResponseSchema,
  v2_3_ResponseSchema,
  v2_3_SingleFootprintResponseSchema,
  simpleResponseSchema,
} from "../schemas/responseSchema";
import {
  getCorrectAuthHeaders,
  getIncorrectAuthHeaders,
} from "../utils/authUtils";

export const generateV2TestCases = ({
  testRunId,
  footprints,
  paginationLinks,
  baseUrl,
  authBaseUrl,
  oidAuthUrl,
  clientId,
  clientSecret,
  authRequestData,
  version,
  webhookUrl,
}: {
  testRunId: string;
  footprints: any;
  paginationLinks: Record<string, string>;
  baseUrl: string;
  authBaseUrl: string;
  oidAuthUrl: string | null | undefined;
  clientId: string;
  clientSecret: string;
  authRequestData: string;
  version: ApiVersion;
  webhookUrl: string;
}): TestCase[] => {
  // Get the correct response schema based on the version
  const responseSchema = (() => {
    switch (version) {
      case "V2.0":
        return v2_0_ResponseSchema;
      case "V2.1":
        return v2_1_ResponseSchema;
      case "V2.2":
        return v2_2_ResponseSchema;
      case "V2.3":
        return v2_3_ResponseSchema;
      default:
        return v2_3_ResponseSchema; // Default to latest if unknown
    }
  })();

  const singleFootprintResponseSchema = (() => {
    switch (version) {
      case "V2.0":
        return v2_0_SingleFootprintResponseSchema;
      case "V2.1":
        return v2_1_SingleFootprintResponseSchema;
      case "V2.2":
        return v2_2_SingleFootprintResponseSchema;
      case "V2.3":
        return v2_3_SingleFootprintResponseSchema;
      default:
        return v2_3_SingleFootprintResponseSchema; // Default to latest if unknown
    }
  })();

  return [
    {
      name: "Test Case 1: Obtain auth token with valid credentials",
      method: "POST",
      customUrl: oidAuthUrl || `${authBaseUrl}/auth/token`,
      requestData: authRequestData,
      expectedStatusCodes: [200],
      headers: getCorrectAuthHeaders(baseUrl, clientId, clientSecret),
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      testKey: "TESTCASE#1",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-1-obtain-auth-token-with-valid-credentials",
    },
    {
      name: "Test Case 2: Obtain auth token with invalid credentials",
      method: "POST",
      customUrl: oidAuthUrl || `${authBaseUrl}/auth/token`,
      requestData: authRequestData,
      expectedStatusCodes: [400, 401],
      headers: getIncorrectAuthHeaders(baseUrl),
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      testKey: "TESTCASE#2",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-2-obtain-auth-token-with-invalid-credentials",
    },
    {
      name: "Test Case 3: Get PCF using GetFootprint",
      method: "GET",
      endpoint: `/2/footprints/${footprints.data[0].id}`,
      expectedStatusCodes: [200],
      schema: singleFootprintResponseSchema,
      condition: ({ data }) => {
        return data.id === footprints.data[0].id;
      },
      conditionErrorMessage: `Returned footprint does not match the requested footprint with id ${footprints.data[0].id}`,
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      testKey: "TESTCASE#3",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-3-get-pcf-using-getfootprint",
    },
    {
      name: "Test Case 4: Get all PCFs using ListFootprints",
      method: "GET",
      endpoint: "/2/footprints",
      expectedStatusCodes: [200, 202],
      schema: responseSchema,
      condition: ({ data }) => {
        return data.length === footprints.data.length;
      },
      conditionErrorMessage: "Number of footprints does not match",
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      testKey: "TESTCASE#4",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-4-get-all-pcfs-using-listfootprints",
    },
    {
      name: "Test Case 5: Pagination link implementation of Action ListFootprints",
      method: "GET",
      endpoint: Object.values(paginationLinks)[0]?.replace(baseUrl, ""),
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      testKey: "TESTCASE#5",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-5-pagination-link-implementation-of-action-listfootprints",
    },
    {
      name: "Test Case 6: Attempt ListFootPrints with Invalid Token",
      method: "GET",
      endpoint: `/2/footprints`,
      expectedStatusCodes: [400, 401],
      condition: ({ code }) => {
        return code === "BadRequest";
      },
      conditionErrorMessage: `Expected error code BadRequest in response.`,
      headers: {
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      },
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      testKey: "TESTCASE#6",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-6-attempt-listfootprints-with-invalid-token",
    },
    {
      name: "Test Case 7: Attempt GetFootprint with Invalid Token",
      method: "GET",
      endpoint: `/2/footprints/${footprints.data[0].id}`,
      expectedStatusCodes: [400, 401],
      condition: ({ code }) => {
        return code === "BadRequest";
      },
      conditionErrorMessage: `Expected error code BadRequest in response.`,
      headers: {
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      },
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      testKey: "TESTCASE#7",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-7-attempt-getfootprint-with-invalid-token",
    },
    {
      name: "Test Case 8: Attempt GetFootprint with Non-Existent PfId",
      method: "GET",
      endpoint: `/2/footprints/random-string-as-id-${randomString(16)}`,
      expectedStatusCodes: [400, 404],
      condition: ({ code }) => {
        return code === "NoSuchFootprint";
      },
      conditionErrorMessage: `Expected error code NoSuchFootprint in response.`,
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      testKey: "TESTCASE#8",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-8-attempt-getfootprint-with-non-existent-pfid",
    },
    {
      name: "Test Case 9: Attempt Authentication through HTTP (non-HTTPS)",
      customUrl:
        oidAuthUrl?.replace("https", "http") ||
        `${authBaseUrl.replace("https", "http")}/auth/token`,
      method: "POST",
      headers: getCorrectAuthHeaders(baseUrl, clientId, clientSecret),
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      expectHttpError: true,
      testKey: "TESTCASE#9",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-9-attempt-authentication-through-http-non-https",
      requestData: authRequestData,
      condition: (response) => {
        return !response.data && !response.access_token;
      },
      conditionErrorMessage:
        "Expected response to not include data or access_token property",
    },
    {
      name: "Test Case 10: Attempt ListFootprints through HTTP (non-HTTPS)",
      method: "GET",
      customUrl: `${baseUrl.replace("https", "http")}/2/footprints`,
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      expectHttpError: true,
      testKey: "TESTCASE#10",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-10-attempt-listfootprints-through-http-non-https",
      condition: (response) => {
        return !response.data;
      },
      conditionErrorMessage: "Expected response to not include data property",
    },
    {
      name: "Test Case 11: Attempt GetFootprint through HTTP (non-HTTPS)",
      method: "GET",
      customUrl: `${baseUrl.replace("https", "http")}/2/footprints/${
        footprints.data[0].id
      }`,
      mandatoryVersion: ["V2.0", "V2.1", "V2.2", "V2.3"],
      expectHttpError: true,
      testKey: "TESTCASE#11",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-11-attempt-getfootprint-through-http-non-https",
      condition: (response) => {
        return !response.data;
      },
      conditionErrorMessage: "Expected response to not include data property",
    },
    {
      name: "Test Case 12: Receive Asynchronous PCF Request",
      method: "POST",
      endpoint: `/2/events`,
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      },
      expectedStatusCodes: [200],
      requestData: {
        specversion: "1.0",
        id: testRunId,
        source: webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV2.CREATED,
        data: {
          pf: {
            productIds: footprints.data[0].productIds,
          },
          comment: "Please send PCF data for this year.",
        },
      },
      mandatoryVersion: ["V2.2", "V2.3"],
      testKey: "TESTCASE#12",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-12-receive-asynchronous-pcf-request",
    },
    {
      name: "Test Case 13: Received Request Fulfilled Response",
      callback: true,
      endpoint: '/2/events',
      method: "POST",
      schema: undefined, // v2_0_EventFulfilledSchema
      mandatoryVersion: ["V2.2", "V2.3"],
      testKey: "TESTCASE#13",
      documentationUrl: 
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-13-respond-to-pcf-request-fulfilled-event",
    },
    {
      name: "Test Case 14.A: Send Asynchronous Request to be Rejected",
      method: "POST",
      endpoint: `/2/events`,
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      },
      expectedStatusCodes: [200],
      requestData: {
        specversion: "1.0",
        id: testRunId,
        source: webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV2.CREATED,
        data: {
          pf: {
            productIds: ["urn:pact:null"], // SPs will be instructed to reject a request with null productIds,
          },
          comment: "Please send PCF data for this year.",
        },
      },
      mandatoryVersion: ["V2.2", "V2.3"],
      testKey: "TESTCASE#14.A",
      documentationUrl: 
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14-respond-to-pcf-request-rejected-event",
    },
    {
      name: "Test Case 14.B: Handle Rejected PCF Request",
      callback: true,
      endpoint: '/2/events',
      method: "POST",
      schema: undefined, // v2_0_EventRejectedSchema,
      mandatoryVersion: ["V2.2", "V2.3"],
      testKey: "TESTCASE#14.B",
      documentationUrl: 
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14-respond-to-pcf-request-rejected-event",
    },
    {
      name: "Test Case 15: Receive Notification of PCF Update (Published Event)",
      method: "POST",
      endpoint: `/2/events`,
      expectedStatusCodes: [200],
      requestData: {
        type: EventTypesV2.PUBLISHED,
        specversion: "1.0",
        id: randomUUID(),
        source: webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      },
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      },
      mandatoryVersion: ["V2.2", "V2.3"],
      testKey: "TESTCASE#15",
      documentationUrl: 
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-15-receive-notification-of-pcf-update-published-event",
    },
    {
      name: "Test Case 16: Attempt Action Events with Invalid Token",
      method: "POST",
      endpoint: `/2/events`,
      expectedStatusCodes: [400, 401],
      requestData: {
        type: EventTypesV2.PUBLISHED,
        specversion: "1.0",
        id: testRunId,
        source: webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      },
      headers: {
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      },
      condition: ({ code }) => {
        return code === "BadRequest";
      },
      mandatoryVersion: ["V2.2", "V2.3"],
      testKey: "TESTCASE#16",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-16-attempt-action-events-with-invalid-token",
    },
    {
      name: "Test Case 17: Attempt Action Events through HTTP (non-HTTPS)",
      method: "POST",
      customUrl: `${baseUrl.replace("https", "http")}/2/events`,
      requestData: {
        specversion: "1.0",
        id: testRunId,
        source: webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV2.PUBLISHED,
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      },
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      },
      mandatoryVersion: ["V2.2", "V2.3"],
      expectHttpError: true,
      testKey: "TESTCASE#17",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-17-attempt-action-events-through-http-non-https",
      condition: (response) => {
        return !response.data;
      },
      conditionErrorMessage: "Expected response to not include data property",
    },
    {
      name: "Test Case 18: OpenId Connect-based Authentication Flow",
      method: "POST",
      customUrl: oidAuthUrl || undefined,
      expectedStatusCodes: [200],
      headers: getCorrectAuthHeaders(baseUrl, clientId, clientSecret),
      testKey: "TESTCASE#18",
      requestData: authRequestData,
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-18-openid-connect-based-authentication-flow",
    },
    {
      name: "Test Case 19: OpenId connect-based authentication flow with incorrect credentials",
      method: "POST",
      customUrl: oidAuthUrl || undefined,
      expectedStatusCodes: [400, 401],
      headers: getIncorrectAuthHeaders(baseUrl),
      testKey: "TESTCASE#19",
      requestData: authRequestData,
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-19-openid-connect-based-authentication-flow-with-incorrect-credentials",
    },
    {
      name: "Test Case 20: Get Filtered List of Footprints",
      method: "GET",
      endpoint: `/2/footprints?$filter=${encodeURIComponent(
        `created ge '${footprints.data[0].created}'`
      )}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: ({ data }) => {
        return data.every(
          (footprint: { created: Date }) =>
            footprint.created >= footprints.data[0].created
        );
      },
      conditionErrorMessage: `One or more footprints do not match the condition: 'created date >= ${footprints.data[0].created}'`,
      testKey: "TESTCASE#20",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-20-get-filtered-list-of-footprints",
    },
    {
      name: "Test Case 21: Failed to Receive Notification of PCF Update (Published Event) - Malformed Request",
      method: "POST",
      endpoint: `/2/events`,
      expectedStatusCodes: [400],
      requestData: {
        type: EventTypesV2.PUBLISHED,
        specversion: "1.0",
        id: randomUUID(),
        source: webhookUrl,
        time: new Date().toISOString(),
        data: {
          pfIds: ["urn:gtin:4712345060507"],
        },
      },
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      },
      mandatoryVersion: ["V2.2", "V2.3"],
      testKey: "TESTCASE#21",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-21-failed-to-receive-notification-of-pcf-update-published-event-malformed-request",
    },
  ];
};
