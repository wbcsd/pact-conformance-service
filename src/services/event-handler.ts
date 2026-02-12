import Ajv from "ajv";
import * as jwt from "jsonwebtoken";
import addFormats from "ajv-formats";
import betterErrors from "ajv-errors";
import config from "../config";
import { TestStorage } from "./types";
import { EventTypesV2, EventTypesV3, TestResult, TestCaseResultStatus, TestRun } from "./types";
import { getSchema } from "../schemas";
import logger from "../utils/logger";
import { BadRequestError, UnauthorizedError, NotFoundError } from "../errors";

// Initialize Ajv validator
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
betterErrors(ajv);

const TEST_CASE_13_NAME = "Test Case 13: Respond to Asynchronous PCF Request";
const TEST_CASE_14_NAME = "Test Case 14.B: Handle Rejected PCF Request";
const MANDATORY_VERSIONS = ["V2.2", "V2.3", "V3.0"];

export interface EventData {
  requestEventId: string;
  pfs?: Array<{ productIds: string[] }>;
  error?: { code: string; message: string };
}

export interface EventPayload {
  type: string;
  data: EventData;
  [key: string]: any;
}

export interface AuthRequest {
  clientId: string;
  clientSecret: string;
}

/**
 * EventHandler handles all callback events related to test runs fired by
 * the TestRunService. This includes authentication and event processing logic.
 */
export class EventHandler {
  
  constructor(private storage: TestStorage) {}

  /**
   * Authenticate client credentials and generate JWT token
   */
  async authenticate(authRequest: AuthRequest): Promise<{ access_token: string }> {
    if (!authRequest.clientId || !authRequest.clientSecret) {
      throw new BadRequestError("Missing client credentials");
    }

    if (authRequest.clientId !== "test_client_id" || authRequest.clientSecret !== "test_client_secret") {
      throw new UnauthorizedError("Invalid client credentials");
    }
    const token = jwt.sign({ clientId: authRequest.clientId }, config.JWT_SECRET, { expiresIn: "1h" });

    return { access_token: token };
  }

  /**
   * Process callback events from tested client APIs
   */
  async processEvent(eventPayload: EventPayload, requestPath: string): Promise<void> {
    // Validate event payload
    if (!eventPayload) {
      throw new BadRequestError("Request body is missing");
    }

    if (!eventPayload.data?.requestEventId) {
      throw new BadRequestError("Missing requestEventId in event data");
    }

    logger.info("Processing event:", { path: requestPath, type: eventPayload.type, requestEventId: eventPayload.data.requestEventId });

    const dashIndex = eventPayload.data.requestEventId.indexOf("-");
    const testRunId = dashIndex === -1
      ? eventPayload.data.requestEventId
      : eventPayload.data.requestEventId.slice(0, dashIndex);

    // Will throw an error if not found
    const testRun = await this.storage.getTestRun(testRunId);

    // Process fulfilled events
    if (eventPayload.type === EventTypesV2.FULFILLED || eventPayload.type === EventTypesV3.FULFILLED) {
      await this.processFulfilledEvent(eventPayload, testRunId, testRun, requestPath);
    }
    // Process rejected events  
    else if (eventPayload.type === EventTypesV2.REJECTED || eventPayload.type === EventTypesV3.REJECTED) {
      await this.processRejectedEvent(eventPayload, testRunId, testRun, requestPath);
    }
    
    // Note: Other event types are silently ignored per original logic
  }

  /**
   * Process fulfilled events (Test Case 13)
   */
  private async processFulfilledEvent(
    eventPayload: EventPayload, 
    testRunId: string,
    testRun: TestRun, 
    requestPath: string
  ): Promise<void> {
    const isMandatory = MANDATORY_VERSIONS.includes(testRun.techSpecVersion);

    // Validate event against schema
    const schemas = await getSchema(testRun.techSpecVersion);
    const validateEvent = ajv.compile(schemas.events?.fulfilled);
    const eventIsValid = validateEvent(eventPayload);

    // Validate request path
    const expectedPath = testRun.techSpecVersion.startsWith("V2") ? "/2/events" : "/3/events";
    const isPathValid = requestPath === expectedPath;

    let testResult: TestResult;

    if (eventIsValid && isPathValid) {
      testResult = {
        name: TEST_CASE_13_NAME,
        status: TestCaseResultStatus.SUCCESS,
        mandatory: isMandatory,
        testKey: "TESTCASE#13",
        documentationUrl: testRun.techSpecVersion.startsWith("V2")
          ? "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-13-respond-to-pcf-request-fulfilled-event"
          : "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-13-respond-to-pcf-request-fulfilled-event",
      };
    } else {
      let errorMessage = "";
      if (!eventIsValid) {
        errorMessage += `Event validation failed: ${JSON.stringify(validateEvent.errors)}`;
      }
      if (!isPathValid) {
        if (errorMessage) errorMessage += "; ";
        errorMessage += `Invalid request path: expected ${expectedPath}, but received ${requestPath}`;
      }

      testResult = {
        name: TEST_CASE_13_NAME,
        status: TestCaseResultStatus.FAILURE,
        mandatory: isMandatory,
        testKey: "TESTCASE#13",
        errorMessage,
        documentationUrl: testRun.techSpecVersion.startsWith("V2")
          ? "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-13-respond-to-pcf-request-fulfilled-event"
          : "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-13-respond-to-pcf-request-fulfilled-event",
      };
    }

    // Validate product IDs
    if (eventPayload.data.pfs && testResult.status === TestCaseResultStatus.SUCCESS) {
      const productIds = eventPayload.data.pfs.flatMap(
        (pf: { productIds: string[] }) => pf.productIds
      );

      const testRunData = testRun.data as { productIds?: string[] } | null;
      const testPassed = testRunData?.productIds?.some((id: string) =>
        productIds.includes(id)
      );

      if (!testPassed) {
        testResult = {
          ...testResult,
          status: TestCaseResultStatus.FAILURE,
          errorMessage: `Product IDs do not match, the request was made for productIds [${testRunData?.productIds}] but received data for productIds [${productIds}]`,
        };
      }
    }

    // Save this test result, changing it from PEMNDING to eiter SUCCESS or FAILURE, 
    // and then update the overall test run status accordingly.   
    await this.storage.saveTestCaseResults(testRunId, [testResult], true);
    await this.storage.updateTestRunStatus(testRunId);
  }

  /**
   * Process rejected events (Test Case 14.B)
   */
  private async processRejectedEvent(
    eventPayload: EventPayload,
    testRunId: string,
    testRun: TestRun,
    requestPath: string
  ): Promise<void> {
    logger.info("Processing rejected event:", JSON.stringify(eventPayload, null, 2));

    const isMandatory = MANDATORY_VERSIONS.includes(testRun.techSpecVersion);
    
    // Validate request path
    const expectedPath = testRun.techSpecVersion.startsWith("V2") ? "/2/events" : "/3/events";
    const isPathValid = requestPath === expectedPath;

    // Validate error object
    const hasValidErrorObject = 
      eventPayload.data.error && 
      eventPayload.data.error.code && 
      eventPayload.data.error.message;

    let testResult: TestResult;

    if (hasValidErrorObject && isPathValid) {
      testResult = {
        name: TEST_CASE_14_NAME,
        status: TestCaseResultStatus.SUCCESS,
        mandatory: isMandatory,
        testKey: "TESTCASE#14.B",
        documentationUrl: testRun.techSpecVersion.startsWith("V2")
          ? "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-14-respond-to-pcf-request-rejected-event"
          : "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14-respond-to-pcf-request-rejected-event",
      };
    } else {
      let errorMessage = "";
      if (!hasValidErrorObject) {
        errorMessage += "Rejected event must contain an error object with a code and message";
      }
      if (!isPathValid) {
        if (errorMessage) errorMessage += "; ";
        errorMessage += `Invalid request path: expected ${expectedPath}, but received ${requestPath}`;
      }

      testResult = {
        name: TEST_CASE_14_NAME,
        status: TestCaseResultStatus.FAILURE,
        mandatory: isMandatory,
        testKey: "TESTCASE#14.B",
        errorMessage,
        documentationUrl: testRun.techSpecVersion.startsWith("V2")
          ? "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-14-respond-to-pcf-request-rejected-event"
          : "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14-respond-to-pcf-request-rejected-event",
      };
    }

    // Save this test result, changing it from PEMNDING to eiter SUCCESS or FAILURE, 
    // and then update the overall test run status accordingly.   
    await this.storage.saveTestCaseResults(testRunId, [testResult], true);
    await this.storage.updateTestRunStatus(testRunId);
  }

  /**
   * Parse Basic authentication header
   */
  parseBasicAuth(authHeader?: string): AuthRequest {
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      throw new BadRequestError("Missing or invalid Authorization header");
    }

    const base64Credentials = authHeader.slice("Basic ".length).trim();
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
    const [clientId, clientSecret] = credentials.split(":");

    if (!clientId || !clientSecret) {
      throw new BadRequestError("Invalid Basic authentication format");
    }

    return { clientId, clientSecret };
  }
}

