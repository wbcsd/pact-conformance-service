import { Request, Response } from 'express';
import Ajv from "ajv";
import * as jwt from "jsonwebtoken";
import addFormats from "ajv-formats";
import betterErrors from "ajv-errors";
import { EventTypesV2, EventTypesV3, TestResult, TestCaseResultStatus } from "../types/types";
import { eventFulfilledSchema, v3_0_EventFulfilledSchema } from "../schemas/responseSchema";
// import { Database } from '../data/interfaces/Database';
// import { DatabaseFactory } from '../data/factory'; 
// TODO: Use Database instead of dbUtils
import {
  getTestData,
  getTestResults,
  saveTestCaseResult,
  updateTestRunStatus,
} from "../utils/dbUtils";
import { calculateTestRunMetrics } from "../utils/testRunMetrics";
import logger from "../utils/logger";

// Initialize Ajv validator
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
betterErrors(ajv);

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

const TEST_CASE_13_NAME = "Test Case 13: Respond to Asynchronous PCF Request";
const TEST_CASE_14_NAME = "Test Case 14.B: Handle Rejected PCF Request";

const MANDATORY_VERSIONS = ["V2.2", "V2.3", "V3.0"];

export class EventController {
  // TODO: private db: Database;

  constructor() {
    // TODO: this.db = DatabaseFactory.create();
  }


  /*
   * POST /auth/token - Authenticate client and provide JWT token
   * Migrated from authForAsyncListener Lambda
  */
  async authToken(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers.authorization?.[0];

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      res.status(400).json({ code: "BadRequest" });
      return;
    }

    const base64Credentials = authHeader.slice("Basic ".length).trim();
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
    const [clientId, clientSecret] = credentials.split(":");

    if (clientId !== "test_client_id" || clientSecret !== "test_client_secret") {
      res.status(400).json({ code: "BadRequest" });
      return;
    }

    const token = jwt.sign({ clientId }, JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({ access_token: token });
  };

  /*
   * POST /2/event
   * POST /3/event - Handle callback events from the tested client API
   * Migrated from asyncRequestListener Lambda
  */
  async handleEvent(req: Request, res: Response): Promise<void> {
    try {
      // Log the entire event for debugging
      logger.info("Received event:", { url: req.url, body: req.body });

      // Parse and log the request body
      if (!req.body) {
        throw new Error("Request body is missing");
      }

      const testData = await getTestData(req.body.data.requestEventId);

      if (!testData) {
        throw new Error(`Test data not found for requestEventId: ${req.body.data.requestEventId}`);
      }

      /* We only care about the fulfilled event in response to TESTCASE#12 for this part as Test Case 13 is basically a follow-up
          that processes the call back from a host system in response to the event fired in test case 12 */
      if (
        req.body.type === EventTypesV2.FULFILLED ||
        req.body.type === EventTypesV3.FULFILLED
      ) {
        const isMandatory = MANDATORY_VERSIONS.includes(testData.version);

        let testResult: TestResult;

        const validateEvent = ajv.compile(
          testData.version.startsWith("V2")
            ? eventFulfilledSchema
            : v3_0_EventFulfilledSchema
        );
        const eventIsValid = validateEvent(req.body);

        // Validate the request path based on version
        const expectedPath = testData.version.startsWith("V2")
          ? "/2/events"
          : "/3/events";
        const actualPath = req.url;
        const isPathValid = actualPath === expectedPath;

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
            errorMessage += `Event validation failed: ${JSON.stringify(
              validateEvent.errors
            )}`;
          }
          if (!isPathValid) {
            if (errorMessage) errorMessage += "; ";
            errorMessage += `Invalid request path: expected ${expectedPath}, but received ${actualPath}`;
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

        const productIds = req.body.data.pfs.flatMap(
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

        await saveTestCaseResult(req.body.data.requestEventId, testResult, true);

        // Load updated test results and recalculate test run status
        const existingTestRun = await getTestResults(req.body.data.requestEventId);
        if (existingTestRun?.results) {
          const { testRunStatus, passingPercentage } = calculateTestRunMetrics(
            existingTestRun.results
          );
          await updateTestRunStatus(
            req.body.data.requestEventId,
            testRunStatus,
            passingPercentage
          );
          console.info(
            `Updated test run status: ${testRunStatus}, passing percentage: ${passingPercentage}%`
          );
        }
      } else if (
        req.body.type === EventTypesV2.REJECTED ||
        req.body.type === EventTypesV3.REJECTED
      ) {
        console.info(
          "Processing rejected event:",
          JSON.stringify(req.body, null, 2)
        );

        const isMandatory = MANDATORY_VERSIONS.includes(testData.version);
        let testResult: TestResult;

        // Validate the request path based on version
        const expectedPath = testData.version.startsWith("V2")
          ? "/2/events"
          : "/3/events";
        const actualPath = req.url;
        const isPathValid = actualPath === expectedPath;

        // For rejected events, we check that the error object has a code and message, plus path validation
        const hasValidErrorObject =
          req.body.data.error && req.body.data.error.code && req.body.data.error.message;

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
            errorMessage +=
              "Rejected event must contain an error object with a code and message";
          }
          if (!isPathValid) {
            if (errorMessage) errorMessage += "; ";
            errorMessage += `Invalid request path: expected ${expectedPath}, but received ${actualPath}`;
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

        await saveTestCaseResult(req.body.data.requestEventId, testResult, true);

        // Load updated test results and recalculate test run status
        const existingTestRunForRejected = await getTestResults(
          req.body.data.requestEventId
        );
        if (existingTestRunForRejected?.results) {
          const { testRunStatus, passingPercentage } = calculateTestRunMetrics(
            existingTestRunForRejected.results
          );
          await updateTestRunStatus(
            req.body.data.requestEventId,
            testRunStatus,
            passingPercentage
          );
          console.info(
            `Updated test run status: ${testRunStatus}, passing percentage: ${passingPercentage}%`
          );
        }
      }
      
      res.status(200).send();
      return;

    } catch (error) {
      logger.error("Error processing request:", error);

      res.status(400).json({
        code: "BadRequest",
        message: "Bad Request",
      });
      return;
    }
  }
}

// Create controller instance
export const eventController = new EventController();

// Export route handlers
export const authToken = async (req: Request, res: Response) =>
  await eventController.authToken(req, res);

export const handleEvent = async (req: Request, res: Response) =>
  await eventController.handleEvent(req, res);


