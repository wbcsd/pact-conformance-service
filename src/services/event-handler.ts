import Ajv from "ajv";
import * as jwt from "jsonwebtoken";
import addFormats from "ajv-formats";
import betterErrors from "ajv-errors";
import config from "../config";
import { TestStorage } from "./types";
import { EventTypesV2, EventTypesV3, TestResult, TestCaseResultStatus, TestData } from "./types";
import { eventFulfilledSchema, v3_0_EventFulfilledSchema } from "../schemas/responseSchema";
import { calculateTestRunMetrics } from "../utils/testRunMetrics";
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

    const testData = await this.storage.getTestData(eventPayload.data.requestEventId);

    if (!testData) {
      throw new NotFoundError(`Test data not found for requestEventId: ${eventPayload.data.requestEventId}`);
    }

    // Process fulfilled events
    if (eventPayload.type === EventTypesV2.FULFILLED || eventPayload.type === EventTypesV3.FULFILLED) {
      await this.processFulfilledEvent(eventPayload, testData, requestPath);
    }
    // Process rejected events  
    else if (eventPayload.type === EventTypesV2.REJECTED || eventPayload.type === EventTypesV3.REJECTED) {
      await this.processRejectedEvent(eventPayload, testData, requestPath);
    }
    
    // Note: Other event types are silently ignored per original logic
  }

  /**
   * Process fulfilled events (Test Case 13)
   */
  private async processFulfilledEvent(eventPayload: EventPayload, testData: TestData, requestPath: string): Promise<void> {
    const isMandatory = MANDATORY_VERSIONS.includes(testData.version);

    // Validate event against schema
    const validateEvent = ajv.compile(
      testData.version.startsWith("V2") ? eventFulfilledSchema : v3_0_EventFulfilledSchema
    );
    const eventIsValid = validateEvent(eventPayload);

    // Validate request path
    const expectedPath = testData.version.startsWith("V2") ? "/2/events" : "/3/events";
    const isPathValid = requestPath === expectedPath;

    let testResult: TestResult;

    if (eventIsValid && isPathValid) {
      testResult = {
        name: TEST_CASE_13_NAME,
        status: TestCaseResultStatus.SUCCESS,
        mandatory: isMandatory,
        testKey: "TESTCASE#13",
        documentationUrl: testData.version.startsWith("V2")
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
        documentationUrl: testData.version.startsWith("V2")
          ? "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-13-respond-to-pcf-request-fulfilled-event"
          : "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-13-respond-to-pcf-request-fulfilled-event",
      };
    }

    // Validate product IDs
    if (eventPayload.data.pfs && testResult.status === TestCaseResultStatus.SUCCESS) {
      const productIds = eventPayload.data.pfs.flatMap(
        (pf: { productIds: string[] }) => pf.productIds
      );

      const testPassed = testData.productIds.some((id: string) =>
        productIds.includes(id)
      );

      if (!testPassed) {
        testResult = {
          ...testResult,
          status: TestCaseResultStatus.FAILURE,
          errorMessage: `Product IDs do not match, the request was made for productIds [${testData.productIds}] but received data for productIds [${productIds}]`,
        };
      }
    }

    await this.saveTestResultAndUpdateStatus(eventPayload.data.requestEventId, testResult);
  }

  /**
   * Process rejected events (Test Case 14.B)
   */
  private async processRejectedEvent(eventPayload: EventPayload, testData: TestData, requestPath: string): Promise<void> {
    logger.info("Processing rejected event:", JSON.stringify(eventPayload, null, 2));

    const isMandatory = MANDATORY_VERSIONS.includes(testData.version);
    
    // Validate request path
    const expectedPath = testData.version.startsWith("V2") ? "/2/events" : "/3/events";
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
        documentationUrl: testData.version.startsWith("V2")
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
        documentationUrl: testData.version.startsWith("V2")
          ? "https://docs.carbon-transparency.org/pact-conformance-service/v2-test-cases-expected-results.html#test-case-14-respond-to-pcf-request-rejected-event"
          : "https://docs.carbon-transparency.org/pact-conformance-service/v3-test-cases-expected-results.html#test-case-14-respond-to-pcf-request-rejected-event",
      };
    }

    await this.saveTestResultAndUpdateStatus(eventPayload.data.requestEventId, testResult);
  }

  /**
   * Save test result and update test run status
   */
  private async saveTestResultAndUpdateStatus(testRunId: string, testResult: TestResult): Promise<void> {
    await this.storage.saveTestCaseResult(testRunId, testResult, true);

    // Load updated test results and recalculate test run status
    const existingTestRun = await this.storage.getTestResults(testRunId);
    if (existingTestRun?.results) {
      const { testRunStatus, passingPercentage } = calculateTestRunMetrics(existingTestRun.results);
      await this.storage.updateTestRunStatus(testRunId, testRunStatus, passingPercentage);
      logger.info(`Updated test run status: ${testRunStatus}, passing percentage: ${passingPercentage}%`);
    }
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

