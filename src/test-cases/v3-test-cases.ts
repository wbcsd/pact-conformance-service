import { ApiVersion, TestCase, EventTypesV3 } from "../services/types";
import { randomUUID } from "crypto";
import { randomString } from "../utils/authUtils";
import {
  simpleResponseSchema,
  emptyResponseSchema,
  authTokenResponseSchema,
  schemas,
} from "../schemas";
import {
  getCorrectAuthHeaders,
  getIncorrectAuthHeaders,
} from "../utils/authUtils";

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

interface FootprintsData {
  data: Footprint[];
}

function isValidDate(date: Date) {
  return date instanceof Date && !isNaN(date.getTime());
}

const getFilterParameters = (footprints: FootprintsData) => {
  if (!footprints.data?.[0]) {
    throw new Error(
      "Invalid footprints data: Missing required data structure. Please check the API response."
    );
  }

  const firstFootprint = footprints.data[0];

  // Check if validityPeriodStart or validityPeriodEnd are empty or invalid
  const hasValidityPeriod =
    firstFootprint.validityPeriodStart &&
    firstFootprint.validityPeriodEnd &&
    isValidDate(new Date(firstFootprint.validityPeriodStart)) &&
    isValidDate(new Date(firstFootprint.validityPeriodEnd));

  let validityStart: string;
  let validityEnd: string;

  if (!hasValidityPeriod) {
    // Use PCF reference period as fallback
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

    // Use referencePeriodEnd as validityStart and add 3 years for validityEnd
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

export const generateV3TestCases = ({
  testRunId,
  footprints,
  paginationLinks,
  baseUrl,
  authTokenUrl,
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
  authTokenUrl: string;
  clientId: string;
  clientSecret: string;
  authRequestData: string;
  version: ApiVersion;
  webhookUrl: string;
}): TestCase[] => {
  const responseSchema = (() => {
    switch (version) {
      case "V3.0":
        return schemas['3.0'].listFootprintsResponse;
      default:
        return schemas['3.0'].listFootprintsResponse; // Default to latest if unknown
    }
  })();

  const filterParams = getFilterParameters(footprints);
  const callbackBaseUrl = webhookUrl.replace(/\/+$/, "");

  return [
    {
      name: "Test Case 1: Obtain auth token with valid credentials",
      method: "POST",
      customUrl: authTokenUrl,
      requestData: authRequestData,
      expectedStatusCodes: [200],
      headers: getCorrectAuthHeaders(baseUrl, clientId, clientSecret),
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#1",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-1-obtain-auth-token-with-valid-credentials",
    },
    {
      name: "Test Case 2: Obtain auth token with invalid credentials",
      method: "POST",
      customUrl: authTokenUrl,
      requestData: authRequestData,
      expectedStatusCodes: [400, 401],
      headers: getIncorrectAuthHeaders(baseUrl),
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#2",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-2-obtain-auth-token-with-invalid-credentials",
    },
    {
      name: "Test Case 3: Get PCF using GetFootprint",
      method: "GET",
      endpoint: `/3/footprints/${filterParams.id}`,
      expectedStatusCodes: [200],
      schema: schemas['3.0'].singleFootprintResponse,
      condition: (body) => {
        return body?.data?.id === filterParams.id;
      },
      conditionErrorMessage: `Returned footprint does not match the requested footprint with id ${filterParams.id}`,
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#3",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-3-get-pcf-using-getfootprint",
    },
    {
      name: "Test Case 4: Get all PCFs using ListFootprints",
      method: "GET",
      endpoint: "/3/footprints",
      expectedStatusCodes: [200, 202],
      schema: responseSchema,
      condition: (body) => {
        return body?.data?.length === footprints.data.length;
      },
      conditionErrorMessage: "Number of footprints does not match",
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#4",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-4-get-all-pcfs-using-listfootprints",
    },
    {
      name: "Test Case 5: Pagination link implementation of Action ListFootprints",
      method: "GET",
      endpoint: Object.values(paginationLinks)[0]?.replace(baseUrl, ""),
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#5",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-5-pagination-link-implementation-of-action-listfootprints",
    },
    {
      name: "Test Case 6: Attempt ListFootPrints with Invalid Token",
      method: "GET",
      endpoint: `/3/footprints`,
      expectedStatusCodes: [400, 401],
      condition: (body, messages) => {
        if (body?.code !== "BadRequest") {
          messages.push(`Warning: expected error code BadRequest but received ${body?.code}`);
        }
        return true;
      },
      headers: {
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      },
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#6",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-6-attempt-listfootprints-with-invalid-token",
    },
    {
      name: "Test Case 7: Attempt GetFootprint with Invalid Token",
      method: "GET",
      endpoint: `/3/footprints/${filterParams.id}`,
      expectedStatusCodes: [400, 401],
      condition: (body, messages) => {
        if (body?.code !== "BadRequest") {
          messages.push(`Warning: expected error code BadRequest but received ${body?.code}`);
        }
        return true;
      },
      headers: {
        Authorization: `Bearer very-invalid-access-token-${randomString(16)}`,
      },
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#7",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-7-attempt-getfootprint-with-invalid-token",
    },
    {
      name: "Test Case 8: Attempt GetFootprint with Non-Existent PfId",
      method: "GET",
      endpoint: `/3/footprints/random-string-as-id-${randomString(16)}`,
      expectedStatusCodes: [400, 404],
      condition: (body) => {
        return body?.code === "NotFound";
      },
      conditionErrorMessage: `Expected error code NotFound in response.`,
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#8",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-8-attempt-getfootprint-with-non-existent-pfid",
    },
    {
      name: "Test Case 9: Attempt Authentication through HTTP (non-HTTPS)",
      customUrl: authTokenUrl.replace("https", "http"),
      method: "POST",
      headers: getCorrectAuthHeaders(baseUrl, clientId, clientSecret),
      mandatoryVersion: ["V3.0"],
      expectHttpError: true,
      expectedStatusCodes: [200],
      schema: authTokenResponseSchema,
      testKey: "TESTCASE#9",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-9-attempt-authentication-through-http-non-https",
      requestData: authRequestData,
    },
    {
      name: "Test Case 10: Attempt ListFootprints through HTTP (non-HTTPS)",
      method: "GET",
      customUrl: `${baseUrl.replace("https", "http")}/3/footprints`,
      mandatoryVersion: ["V3.0"],
      expectHttpError: true,
      expectedStatusCodes: [200, 202],
      schema: responseSchema,
      testKey: "TESTCASE#10",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-10-attempt-listfootprints-through-http-non-https",
    },
    {
      name: "Test Case 11: Attempt GetFootprint through HTTP (non-HTTPS)",
      method: "GET",
      customUrl: `${baseUrl.replace("https", "http")}/3/footprints/${
        filterParams.id
      }`,
      mandatoryVersion: ["V3.0"],
      expectHttpError: true,
      expectedStatusCodes: [200],
      schema: schemas.singleFootprintResponse,
      testKey: "TESTCASE#11",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-11-attempt-getfootprint-through-http-non-https",
    },
    {
      name: "Test Case 12: Send Asynchronous PCF Request",
      method: "POST",
      endpoint: `/3/events`,
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      },
      expectedStatusCodes: [200],
      requestData: {
        specversion: "1.0",
        // Create a unique ID for this event which we can trace back to the test run,
        // when a callback is received.
        id: testRunId + "-12",  
        source: webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV3.CREATED,
        data: {
          productId: filterParams.productIds,
          comment: "Please send PCF data for this year.",
        },
      },
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#12",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-12-send-pcf-creation-request-async",
    },
    {
      name: "Test Case 13: Received Request Fulfilled Response",
      callback: true,
      customUrl: `${callbackBaseUrl}/3/events`,
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
        "Authorization": "Bearer TOKEN"
      },
      method: "POST",
      schema: schemas['3.0'].events?.fulfilled,
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#13",
      documentationUrl: 
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-13-call-back-with-a-request-fulfilled-event",
    },
    {
      name: "Test Case 14.A: Send Asynchronous Request to be Rejected",
      method: "POST",
      endpoint: `/3/events`,
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      },
      expectedStatusCodes: [200],
      requestData: {
        specversion: "1.0",
        // Create a unique ID for this event which we can trace back to the test run,
        // when a callback is received.
        id: testRunId + "-14.A",
        source: webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV3.CREATED,
        data: {
          productId: ["urn:pact:null"], // SPs will be instructed to reject a request with null productIds,
          comment: "Please send PCF data for this year.",
        },
      },
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#14.A",
      documentationUrl: 
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14a-request-for-the-creation-of-a-pcf-to-be-rejected",
    },
    {
      name: "Test Case 14.B: Handle Rejected PCF Request",
      callback: true,
      customUrl: `${callbackBaseUrl}/3/events`,
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
        "Authorization": "Bearer TOKEN"
      },
      method: "POST",
      schema: schemas["3.0"].events?.rejected,
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#14.B",
      documentationUrl: 
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14b-call-back-with-a-request-rejected-event",
    },
    {
      name: "Test Case 15: Receive Notification of PCF Update (Published Event)",
      method: "POST",
      endpoint: `/3/events`,
      expectedStatusCodes: [200],
      requestData: {
        type: EventTypesV3.PUBLISHED,
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
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#15",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-15-receive-notification-of-pcf-update-published-event",
    },
    {
      name: "Test Case 16: Attempt Action Events with Invalid Token",
      method: "POST",
      endpoint: `/3/events`,
      expectedStatusCodes: [400, 401],
      requestData: {
        type: EventTypesV3.PUBLISHED,
        specversion: "1.0",
        id: testRunId + "-16",
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
      condition: (body, messages) => {
        if (body?.code !== "BadRequest") {
          messages.push(`Warning: expected error code BadRequest but received ${body?.code}`);
        }
        return true;
      },
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#16",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-16-attempt-action-events-with-invalid-token",
    },
    {
      name: "Test Case 17: Attempt Action Events through HTTP (non-HTTPS)",
      method: "POST",
      customUrl: `${baseUrl.replace("https", "http")}/3/events`,
      requestData: {
        specversion: "1.0",
        id: testRunId + "-17",
        source: webhookUrl,
        time: new Date().toISOString(),
        type: EventTypesV3.PUBLISHED,
        data: {
          pfIds: ["3a6c14a7-4deb-498a-b5ea-16ce2535b576"],
        },
      },
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
      },
      mandatoryVersion: ["V3.0"],
      expectHttpError: true,
      expectedStatusCodes: [200],
      testKey: "TESTCASE#17",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-17-attempt-action-events-through-http-non-https",
    },
    {
      name: "Test Case 18: OpenId Connect-based Authentication Flow",
      method: "POST",
      customUrl: authTokenUrl.startsWith(baseUrl) ? undefined : authTokenUrl, // Skip if authTokenUrl is under the baseUrl, will not be an OpenID provider then
      expectedStatusCodes: [200],
      headers: getCorrectAuthHeaders(baseUrl, clientId, clientSecret),
      testKey: "TESTCASE#18",
      requestData: authRequestData,
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-18-openid-connect-based-authentication-flow",
    },
    {
      name: "Test Case 19: OpenId connect-based authentication flow with incorrect credentials",
      method: "POST",
      customUrl: authTokenUrl.startsWith(baseUrl) ? undefined : authTokenUrl, // Skip if authTokenUrl is under the baseUrl, will not be an OpenID provider then
      expectedStatusCodes: [400, 401],
      headers: getIncorrectAuthHeaders(baseUrl),
      testKey: "TESTCASE#19",
      requestData: authRequestData,
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-19-openid-connect-based-authentication-flow-with-incorrect-credentials",
    },
    {
      name: `Test Case 20: V3 Filtering Functionality: Get Filtered List of Footprints by "productId" parameter`,
      method: "GET",
      endpoint: `/3/footprints?productId=${filterParams.productId}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: (body) => {
        return body?.data?.every((footprint: { productIds: string[] }) =>
          footprint.productIds.includes(filterParams.productId)
        );
      },
      conditionErrorMessage: `One or more footprints do not match the condition: 'productIds contains ${filterParams.productId}'`,
      testKey: "TESTCASE#20",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-20-v3-filtering-functionality-get-filtered-list-of-footprints-by-productid-parameter",
    },
    {
      name: `Test Case 21: V3 Filtering Functionality: Get Filtered List of Footprints by "companyId" parameter`,
      method: "GET",
      endpoint: `/3/footprints?companyId=${filterParams.companyId}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: (body) => {
        return body?.data?.every((footprint: { companyIds: string[] }) =>
          footprint.companyIds.includes(filterParams.companyId)
        );
      },
      conditionErrorMessage: `One or more footprints do not match the condition: 'companyIds contains ${filterParams.companyId}'`,
      testKey: "TESTCASE#21",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-21-v3-filtering-functionality-get-filtered-list-of-footprints-by-companyid-parameter",
    },
    {
      name: `Test Case 22: V3 Filtering Functionality: Get Filtered List of Footprints by "geography" parameter`,
      method: "GET",
      endpoint: `/3/footprints?geography=${filterParams.geography}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: (body) => {
        if ((filterParams.geography ?? '') === '') {
          return body?.data?.length === footprints.data.length; // If no geography is provided, all footprints are valid
        }
        return body?.data?.every(
          (footprint: {
            pcf: {
              geographyCountry?: string;
              geographyRegionOrSubregion?: string;
              geographyCountrySubdivision?: string;
            };
          }) =>
            footprint.pcf.geographyCountry === filterParams.geography ||
            footprint.pcf.geographyRegionOrSubregion === filterParams.geography ||
            footprint.pcf.geographyCountrySubdivision === filterParams.geography
        );
      },
      conditionErrorMessage: `One or more footprints do not match the condition: 'pcf.geographyCountry = ${filterParams.geography}'`,
      testKey: "TESTCASE#22",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-22-v3-filtering-functionality-get-filtered-list-of-footprints-by-geography-parameter",
    },
    {
      name: `Test Case 23: V3 Filtering Functionality: Get Filtered List of Footprints by "classification" parameter`,
      method: "GET",
      endpoint: `/3/footprints?classification=${filterParams.classification}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: (body) => {
        if ((filterParams.classification ?? '') === '') {
          return body?.data?.length === footprints.data.length; // If no classification is provided, all footprints are valid
        }

        return body?.data?.every((footprint: { productClassifications: string[] }) =>
          footprint.productClassifications.includes(filterParams.classification)
        );
      },
      conditionErrorMessage: `One or more footprints do not match the condition: 'productClassifications contains ${filterParams.classification}'`,
      testKey: "TESTCASE#23",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-23-v3-filtering-functionality-get-filtered-list-of-footprints-by-classification-parameter",
    },
    {
      name: `Test Case 24: V3 Filtering Functionality: Get Filtered List of Footprints by "validOn" parameter`,
      method: "GET",
      endpoint: `/3/footprints?validOn=${filterParams.validOn}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: (body) => {
        return body?.data?.every(
          (footprint: {
            validityPeriodStart: string;
            validityPeriodEnd: string;
            pcf: { referencePeriodEnd: string };
          }) => {
            // Use validity period if available, otherwise fall back to reference period
            const hasValidityPeriod =
              footprint.validityPeriodStart &&
              footprint.validityPeriodEnd &&
              isValidDate(new Date(footprint.validityPeriodStart)) &&
              isValidDate(new Date(footprint.validityPeriodEnd));

            if (hasValidityPeriod) {
              return (
                new Date(footprint.validityPeriodStart) <=
                  new Date(filterParams.validOn) &&
                new Date(footprint.validityPeriodEnd) >=
                  new Date(filterParams.validOn)
              );
            } else if (footprint.pcf.referencePeriodEnd) {
              const refEnd = new Date(footprint.pcf.referencePeriodEnd);
              const refEndPlus3Years = new Date(refEnd);
              refEndPlus3Years.setFullYear(refEndPlus3Years.getFullYear() + 3);
              return (
                refEnd <= new Date(filterParams.validOn) &&
                refEndPlus3Years >= new Date(filterParams.validOn)
              );
            }
            return false;
          }
        );
      },
      conditionErrorMessage: `One or more footprints do not match the condition: 'validityPeriodStart <= ${filterParams.validOn} <= validityPeriodEnd' or fallback reference period logic`,
      testKey: "TESTCASE#24",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-24-v3-filtering-functionality-get-filtered-list-of-footprints-by-validon-parameter",
    },
    {
      name: `Test Case 25: V3 Filtering Functionality: Get Filtered List of Footprints by "validAfter" parameter`,
      method: "GET",
      endpoint: `/3/footprints?validAfter=${filterParams.validAfter}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: (body) => {
        return body?.data?.every(
          (footprint: {
            validityPeriodStart: string;
            pcf: { referencePeriodEnd: string };
          }) => {
            // Use validity period if available, otherwise fall back to reference period
            const hasValidityPeriod =
              footprint.validityPeriodStart &&
              isValidDate(new Date(footprint.validityPeriodStart));

            if (hasValidityPeriod) {
              return (
                new Date(footprint.validityPeriodStart) >
                new Date(filterParams.validAfter)
              );
            } else if (footprint.pcf.referencePeriodEnd) {
              return (
                new Date(footprint.pcf.referencePeriodEnd) >
                new Date(filterParams.validAfter)
              );
            }
            return false;
          }
        );
      },
      conditionErrorMessage: `One or more footprints do not match the condition: 'validityPeriodStart > ${filterParams.validAfter}' or fallback reference period logic`,
      testKey: "TESTCASE#25",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-25-v3-filtering-functionality-get-filtered-list-of-footprints-by-validafter-parameter",
    },
    {
      name: `Test Case 26: V3 Filtering Functionality: Get Filtered List of Footprints by "validBefore" parameter`,
      method: "GET",
      endpoint: `/3/footprints?validBefore=${filterParams.validBefore}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: (body) => {
        return body?.data?.every(
          (footprint: {
            validityPeriodEnd: string;
            pcf: { referencePeriodEnd: string };
          }) => {
            // Use validity period if available, otherwise fall back to reference period
            const hasValidityPeriod =
              footprint.validityPeriodEnd &&
              isValidDate(new Date(footprint.validityPeriodEnd));

            if (hasValidityPeriod) {
              return (
                new Date(footprint.validityPeriodEnd) <
                new Date(filterParams.validBefore)
              );
            } else if (footprint.pcf.referencePeriodEnd) {
              const refEnd = new Date(footprint.pcf.referencePeriodEnd);
              const refEndPlus3Years = new Date(refEnd);
              refEndPlus3Years.setFullYear(refEndPlus3Years.getFullYear() + 3);
              return refEndPlus3Years < new Date(filterParams.validBefore);
            }
            return false;
          }
        );
      },
      conditionErrorMessage: `One or more footprints do not match the condition: 'validityPeriodEnd < ${filterParams.validBefore}' or fallback reference period logic`,
      testKey: "TESTCASE#26",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-26-v3-filtering-functionality-get-filtered-list-of-footprints-by-validbefore-parameter",
    },
    {
      name: `Test Case 27: V3 Filtering Functionality: Get Filtered List of Footprints by "status" parameter`,
      method: "GET",
      endpoint: `/3/footprints?status=${filterParams.status}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: (body) => {
        return body?.data?.every(
          (footprint: { status: string }) =>
            footprint.status === filterParams.status
        );
      },
      conditionErrorMessage: `One or more footprints do not match the condition: 'status = ${filterParams.status}'`,
      testKey: "TESTCASE#27",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-27-v3-filtering-functionality-get-filtered-list-of-footprints-by-status-parameter",
    },
    {
      name: `Test Case 28: V3 Filtering Functionality: Get Filtered List of Footprints by both "status" and "productId" parameters`,
      method: "GET",
      endpoint: `/3/footprints?status=${filterParams.status}&productId=${filterParams.productId}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: (body) => {
        return body?.data?.every(
          (footprint: { status: string; productIds: string[] }) =>
            footprint.status === filterParams.status &&
            footprint.productIds.includes(filterParams.productId)
        );
      },
      conditionErrorMessage: `One or more footprints do not match the condition: 'status = ${filterParams.status} AND productIds contains ${filterParams.productId}'`,
      testKey: "TESTCASE#28",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-28-v3-filtering-functionality-get-filtered-list-of-footprints-by-both-status-and-productid-parameters",
    },
    {
      name: "Test Case 29: V3 Filtering Functionality: Get Filtered List of Footprints by multiple filter parameters using OR logic",
      method: "GET",
      endpoint: `/3/footprints?companyId=${
        filterParams.companyId
      }&companyId=${randomString(8)}&companyId=${randomString(8)}`,
      expectedStatusCodes: [200],
      schema: simpleResponseSchema,
      condition: (body) => {
        return body?.data?.every((footprint: { companyIds: string[] }) =>
          footprint.companyIds.includes(filterParams.companyId)
        );
      },
      conditionErrorMessage: `One or more footprints do not match the companyId filter in OR logic test: ${filterParams.companyId}`,
      testKey: "TESTCASE#29",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-29-v3-filtering-functionality-get-filtered-list-of-footprints-by-multiple-filter-parameters-using-or-logic-positive-test-case",
    },
    {
      name: `Test Case 30: V3 Filtering Functionality: Get Filtered List of Footprints by "productId" parameter (negative test case)`,
      method: "GET",
      endpoint: `/3/footprints?productId=urn:bogus:product:${randomString(16)}`,
      expectedStatusCodes: [200],
      schema: emptyResponseSchema,
      condition: (body) => {
        return body?.data?.length === 0;
      },
      conditionErrorMessage: `Expected empty data array for bogus productId filter`,
      testKey: "TESTCASE#30",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-30-v3-filtering-functionality-get-filtered-list-of-footprints-by-productid-parameter-negative-test-case",
    },
    {
      name: `Test Case 31: V3 Filtering Functionality: Get Filtered List of Footprints by "companyId" parameter (negative test case)`,
      method: "GET",
      endpoint: `/3/footprints?companyId=urn:bogus:company:${randomString(16)}`,
      expectedStatusCodes: [200],
      schema: emptyResponseSchema,
      condition: (body) => {
        return body?.data?.length === 0;
      },
      conditionErrorMessage: `Expected empty data array for bogus companyId filter`,
      testKey: "TESTCASE#31",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-31-v3-filtering-functionality-get-filtered-list-of-footprints-by-companyid-parameter-negative-test-case",
    },
    {
      name: `Test Case 32: V3 Filtering Functionality: Get Filtered List of Footprints by "geography" parameter (negative test case)`,
      method: "GET",
      endpoint: `/3/footprints?geography=XX`,
      expectedStatusCodes: [200],
      schema: emptyResponseSchema,
      condition: (body) => {
        return body?.data?.length === 0;
      },
      conditionErrorMessage: `Expected empty data array for bogus geography filter`,
      testKey: "TESTCASE#32",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-32-v3-filtering-functionality-get-filtered-list-of-footprints-by-geography-parameter-negative-test-case",
    },
    {
      name: `Test Case 33: V3 Filtering Functionality: Get Filtered List of Footprints by "classification" parameter (negative test case)`,
      method: "GET",
      endpoint: `/3/footprints?classification=urn:bogus:classification:${randomString(
        16
      )}`,
      expectedStatusCodes: [200],
      schema: emptyResponseSchema,
      condition: (body) => {
        return body?.data?.length === 0;
      },
      conditionErrorMessage: `Expected empty data array for bogus classification filter`,
      testKey: "TESTCASE#33",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-33-v3-filtering-functionality-get-filtered-list-of-footprints-by-classification-parameter-negative-test-case",
    },
    {
      name: `Test Case 34: V3 Filtering Functionality: Get Filtered List of Footprints by "validOn" parameter (negative test case)`,
      method: "GET",
      endpoint: `/3/footprints?validOn=1900-01-01T00:00:00Z`,
      expectedStatusCodes: [200],
      schema: emptyResponseSchema,
      condition: (body) => {
        return body?.data?.length === 0;
      },
      conditionErrorMessage: `Expected empty data array for bogus validOn filter (date in the past: 1900-01-01T00:00:00Z)`,
      testKey: "TESTCASE#34",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-34-v3-filtering-functionality-get-filtered-list-of-footprints-by-validon-parameter-negative-test-case",
    },
    {
      name: `Test Case 35: V3 Filtering Functionality: Get Filtered List of Footprints by "validAfter" parameter (negative test case)`,
      method: "GET",
      endpoint: `/3/footprints?validAfter=2099-12-31T23:59:59Z`,
      expectedStatusCodes: [200],
      schema: emptyResponseSchema,
      condition: (body) => {
        return body?.data?.length === 0;
      },
      conditionErrorMessage: `Expected empty data array for bogus validAfter filter (date in the future: 2099-12-31T23:59:59Z)`,
      testKey: "TESTCASE#35",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-35-v3-filtering-functionality-get-filtered-list-of-footprints-by-validafter-parameter-negative-test-case",
    },
    {
      name: `Test Case 36: V3 Filtering Functionality: Get Filtered List of Footprints by "validBefore" parameter (negative test case)`,
      method: "GET",
      endpoint: `/3/footprints?validBefore=1900-01-01T00:00:00Z`,
      expectedStatusCodes: [200],
      schema: emptyResponseSchema,
      condition: (body) => {
        return body?.data?.length === 0;
      },
      conditionErrorMessage: `Expected empty data array for bogus validBefore filter (date in the past: 1900-01-01T00:00:00Z)`,
      testKey: "TESTCASE#36",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-36-v3-filtering-functionality-get-filtered-list-of-footprints-by-validbefore-parameter-negative-test-case",
    },
    {
      name: `Test Case 37: V3 Filtering Functionality: Get Filtered List of Footprints by "status" parameter (negative test case)`,
      method: "GET",
      endpoint: `/3/footprints?status=BogusStatus${randomString(8)}`,
      expectedStatusCodes: [200],
      schema: emptyResponseSchema,
      condition: (body) => {
        return body?.data?.length === 0;
      },
      conditionErrorMessage: `Expected empty data array for bogus status filter`,
      testKey: "TESTCASE#37",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-37-v3-filtering-functionality-get-filtered-list-of-footprints-by-status-parameter-negative-test-case",
    },
    {
      name: `Test Case 38: V3 Filtering Functionality: Get Filtered List of Footprints by multilpe filter parameters using AND logic (negative test case)`,
      method: "GET",
      endpoint: `/3/footprints?companyId=urn:bogus:company:${randomString(
        8
      )}&productId=urn:bogus:product:${randomString(16)}`,
      expectedStatusCodes: [200],
      schema: emptyResponseSchema,
      condition: (body) => {
        return body?.data?.length === 0;
      },
      conditionErrorMessage: `Expected empty data array for bogus companyId and productId filters`,
      testKey: "TESTCASE#38",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-38-v3-filtering-functionality-get-filtered-list-of-footprints-by-multilpe-filter-parameters-using-and-logic-negative-test-case",
    },
    {
      name: "Test Case 39: V3 Filtering Functionality: Get Filtered List of Footprints by multilpe filter parameters using OR logic (negative test case)",
      method: "GET",
      endpoint: `/3/footprints?companyId=urn:bogus:company:${randomString(
        8
      )}&companyId=urn:bogus:company:${randomString(
        8
      )}&companyId=urn:bogus:company:${randomString(8)}`,
      expectedStatusCodes: [200],
      schema: emptyResponseSchema,
      condition: (body) => {
        return body?.data?.length === 0;
      },
      conditionErrorMessage: `Expected empty data array for bogus companyId filters in OR logic test`,
      testKey: "TESTCASE#39",
      mandatoryVersion: ["V3.0"],
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-39-v3-filtering-functionality-get-filtered-list-of-footprints-by-multilpe-filter-parameters-using-or-logic-negative-test-case",
    },
    {
      name: "Test Case 40: Failed to Receive Notification of PCF Update (Published Event) - Malformed Request",
      method: "POST",
      endpoint: `/3/events`,
      expectedStatusCodes: [400],
      requestData: {
        type: EventTypesV3.PUBLISHED,
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
      mandatoryVersion: ["V3.0"],
      testKey: "TESTCASE#40",
      documentationUrl:
        "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-40-failed-to-receive-notification-of-pcf-update-published-event-malformed-request",
    },
  ];
};

// implementation of getDateOneDayBefore function
const getDateOneDayBefore = (dateString: string): string => {
  const date = new Date(dateString);
  date.setDate(date.getDate() - 1);
  return date.toISOString();
};

// implementation of getDateOneDayAfter function
const getDateOneDayAfter = (dateString: string): string => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};
