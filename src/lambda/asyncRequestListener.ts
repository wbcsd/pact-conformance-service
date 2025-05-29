import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  EventTypes,
  EventTypesV3,
  TestResult,
  TestResultStatus,
} from "../types/types";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import betterErrors from "ajv-errors";
import {
  eventFulfilledSchema,
  v3_0_EventFulfilledSchema,
} from "../schemas/responseSchema";
import { getTestData, saveTestCaseResult } from "../utils/dbUtils";

// Initialize Ajv validator
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
betterErrors(ajv);

const TEST_CASE_13_NAME = "Test Case 13: Respond to Asynchronous PCF Request";
const TEST_CASE_14_NAME = "Test Case 14: Handle Rejected PCF Request";

const MANDATORY_VERSIONS = ["V2.2", "V2.3", "V3.0"];

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Log the entire event for debugging
    console.log("Received event:", JSON.stringify(event, null, 2));

    // Parse and log the request body
    if (event.body) {
      const body = JSON.parse(event.body);
      console.log("Request body:", JSON.stringify(body, null, 2));

      const testData = await getTestData(body.data.requestEventId);

      if (!testData) {
        console.error(
          `Test data not found for requestEventId: ${body.data.requestEventId}`
        );
        return {
          statusCode: 400,
          body: JSON.stringify({
            code: "BadRequest",
            message: "Bad Request",
          }),
        };
      }

      /* We only care about the fulfilled event in response to TESTCASE#12 for this part as Test Case 13 is basically a follow-up
         that processes the call back from a host system in response to the event fired in test case 12 */
      if (
        body.type === EventTypes.FULFILLED ||
        body.type === EventTypesV3.FULFILLED
      ) {
        const isMandatory = MANDATORY_VERSIONS.includes(testData.version);

        let testResult: TestResult;

        const validateEvent = ajv.compile(
          testData.version.startsWith("V2")
            ? eventFulfilledSchema
            : v3_0_EventFulfilledSchema
        );
        const isValid = validateEvent(body);

        if (isValid) {
          testResult = {
            name: TEST_CASE_13_NAME,
            status: TestResultStatus.SUCCESS,
            success: true,
            mandatory: isMandatory,
            testKey: "TESTCASE#13",
            documentationUrl: testData.version.startsWith("V2")
              ? "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v2-test-cases-expected-results.md#test-case-13-respond-to-pcf-request-fulfilled-event"
              : "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v3-test-cases-expected-results.md#test-case-13-respond-to-pcf-request-fulfilled-event",
          };
        } else {
          testResult = {
            name: TEST_CASE_13_NAME,
            status: TestResultStatus.FAILURE,
            success: false,
            mandatory: isMandatory,
            testKey: "TESTCASE#13",
            errorMessage: `Event validation failed: ${JSON.stringify(
              validateEvent.errors
            )}`,
            documentationUrl: testData.version.startsWith("V2")
              ? "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v2-test-cases-expected-results.md#test-case-13-respond-to-pcf-request-fulfilled-event"
              : "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v3-test-cases-expected-results.md#test-case-13-respond-to-pcf-request-fulfilled-event",
          };
        }

        const productIds = body.data.pfs.flatMap(
          (pf: { productIds: string[] }) => pf.productIds
        );
        const testPassed = testData.productIds.some((id: string) =>
          productIds.includes(id)
        );

        if (!testPassed) {
          testResult = {
            ...testResult,
            status: TestResultStatus.FAILURE,
            success: false,
            errorMessage: `Product IDs do not match, the request was made for productIds [${testData.productIds}] but received data for productIds [${productIds}]`,
          };
        }

        await saveTestCaseResult(body.data.requestEventId, testResult, true);
      } else if (
        body.type === EventTypes.REJECTED ||
        body.type === EventTypesV3.REJECTED
      ) {
        console.log(
          "Processing rejected event:",
          JSON.stringify(body, null, 2)
        );

        const isMandatory = MANDATORY_VERSIONS.includes(testData.version);
        let testResult: TestResult;

        // For rejected events, we just check that the error object has a code and message
        if (
          body.data.error &&
          body.data.error.code &&
          body.data.error.message
        ) {
          testResult = {
            name: TEST_CASE_14_NAME,
            status: TestResultStatus.SUCCESS,
            success: true,
            mandatory: isMandatory,
            testKey: "TESTCASE#14",
            documentationUrl: testData.version.startsWith("V2")
              ? "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v2-test-cases-expected-results.md#test-case-14-respond-to-pcf-request-rejected-event"
              : "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v3-test-cases-expected-results.md#test-case-14-respond-to-pcf-request-rejected-event",
          };
        } else {
          testResult = {
            name: TEST_CASE_14_NAME,
            status: TestResultStatus.FAILURE,
            success: false,
            mandatory: isMandatory,
            testKey: "TESTCASE#14",
            errorMessage:
              "Rejected event must contain an error object with a code and message",
            documentationUrl: testData.version.startsWith("V2")
              ? "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v2-test-cases-expected-results.md#test-case-14-respond-to-pcf-request-rejected-event"
              : "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v3-test-cases-expected-results.md#test-case-14-respond-to-pcf-request-rejected-event",
          };
        }

        await saveTestCaseResult(body.data.requestEventId, testResult, true);
      }
    } else {
      console.error("No request body received");
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Length": 0,
      },
      body: "",
    };
  } catch (error) {
    console.error("Error processing request:", error);

    return {
      statusCode: 400,
      headers: {
        "Content-Length": 0,
      },
      body: JSON.stringify({
        code: "BadRequest",
        message: "Bad Request",
      }),
    };
  }
};
