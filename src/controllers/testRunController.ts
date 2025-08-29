import { Request, Response } from "express";
import config from "../config";
import logger from "../utils/logger";
import {
  TestResult,
  TestCaseResultStatus,
  TestRunStatus,
  ApiVersion,
} from "../types/types";
import { getAccessToken, getOidAuthUrl } from "../utils/authUtils";
import { randomUUID } from "crypto";
import { generateV2TestCases } from "../test-cases/v2-test-cases";
import { generateV3TestCases } from "../test-cases/v3-test-cases";
// import { Database } from '../data/interfaces/Database';
// import { DatabaseFactory } from '../data/factory';
// TODO: Use Database instead of dbUtils
import * as dbUtils from "../utils/dbUtils";
// TODO: Move all this stuff into a service
import {
  fetchFootprints,
  getLinksHeaderFromFootprints
} from "../utils/fetchFootprints";
import { runTestCase } from "../utils/runTestCase";
import { calculateTestRunMetrics } from "../utils/testRunMetrics";

export class TestRunController {
  // TODO: private db: Database;

  constructor() {
    // TODO: this.db = DatabaseFactory.create();
  }

  async searchOrGetTestRuns(req: Request, res: Response): Promise<void> {
    if (req.query.query) {
      await this.searchTestRuns(req, res);
    } else {
      await this.getTestRuns(req, res);
    }
  }

  /**
   * GET /testruns - List all test runs
   * Migrated from getRecentTestRuns Lambda
   */
  async getTestRuns(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Getting recent test runs", { query: req.query });

      const adminEmail = req.query.adminEmail as string;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;

      // Validate limit parameter
      if (limit !== undefined && (isNaN(limit) || limit <= 0 || limit > 200)) {
        res.status(400).json({
          error:
            "Invalid limit parameter. Must be a positive integer between 1 and 200.",
        });
        return;
      }

      const testRuns = await dbUtils.getRecentTestRuns(adminEmail, limit);

      logger.info("Successfully retrieved test runs", {
        count: testRuns.length,
        adminEmail,
        limit,
      });

      res.status(200).json({
        testRuns,
        count: testRuns.length,
      });
    } catch (error) {
      logger.error("Error getting recent test runs:", error);
      res.status(500).json({
        error: "Failed to retrieve test runs",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /testruns/search?query= - Search test runs by company name or admin email
   * New endpoint
   */
  private async searchTestRuns(req: Request, res: Response): Promise<void> {
    try {
      const searchTerm = req.query.query as string;
      const isEmptySearchTerm = !searchTerm || searchTerm.trim() === "";
      const isShortSearchTerm = searchTerm && searchTerm.trim().length < 3;
      const isInvalidTerm = searchTerm && /,;%/gi.test(searchTerm);

      if (isEmptySearchTerm || isShortSearchTerm || isInvalidTerm) {
        res.status(200).json({
          testRuns: [],
          count: 0,
        });
        return;
      }

      const adminEmail = req.query.adminEmail as string;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;

      // Validate limit parameter
      if (limit !== undefined && (isNaN(limit) || limit <= 0 || limit > 200)) {
        res.status(400).json({
          error:
            "Invalid limit parameter. Must be a positive integer between 1 and 200.",
        });
        return;
      }

      logger.info("Searching test runs", { searchTerm });

      const testRuns = await dbUtils.searchTestRuns(
        searchTerm,
        adminEmail,
        limit!
      );

      logger.info("Successfully retrieved search results", {
        count: testRuns.length,
        searchTerm,
      });

      res.status(200).json({
        testRuns,
        count: testRuns.length,
      });
    } catch (error) {
      logger.error("Error searching test runs:", error);
      res.status(500).json({
        error: "Failed to search test runs",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /testruns/:id - Get test run details with results
   * Migrated from getTestResults Lambda
   */
  async getTestRunById(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Remove query parameter after directory service has been adapted.
      const testRunId = req.params.id || (req.query.testRunId as string);

      if (!testRunId) {
        res.status(400).json({
          error: "Missing parameter: testRunId",
        });
        return;
      }

      const result = await dbUtils.getTestResults(testRunId);

      if (!result) {
        logger.warn("Test run not found", { testRunId });
        res.status(404).json({
          error: "Test run not found",
          testRunId,
        });
        return;
      }

      // Calculate passing percentage
      const mandatoryTests = result.results.filter((test) => test.mandatory);
      const failedMandatoryTests = mandatoryTests.filter(
        (test) => test.status !== TestCaseResultStatus.SUCCESS
      );

      const passingPercentage =
        mandatoryTests.length > 0
          ? Math.round(
              ((mandatoryTests.length - failedMandatoryTests.length) /
                mandatoryTests.length) *
                100
            )
          : 0;

      // Calculate non-mandatory passing percentage
      const nonMandatoryTests = result.results.filter(
        (test) => !test.mandatory
      );
      const failedNonMandatoryTests = nonMandatoryTests.filter(
        (test) => test.status !== TestCaseResultStatus.SUCCESS
      );
      const nonMandatoryPassingPercentage =
        nonMandatoryTests.length > 0
          ? Math.round(
              ((nonMandatoryTests.length - failedNonMandatoryTests.length) /
                nonMandatoryTests.length) *
                100
            )
          : 0;

      res.status(200).json({
        ...result,
        passingPercentage,
        nonMandatoryPassingPercentage,
      });
    } catch (error) {
      logger.error("Error getting test results:", error);
      res.status(500).json({
        error: "Failed to retrieve test results",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * POST /testruns - Start a new test run
   * Migrated from runTestCases Lambda
   */
  async createTestRun(req: Request, res: Response): Promise<void> {
    const {
      baseUrl,
      clientId,
      clientSecret,
      version,
      companyName,
      adminEmail,
      adminName,
      customAuthBaseUrl,
      scope,
      audience,
      resource,
    }: {
      baseUrl: string;
      clientId: string;
      clientSecret: string;
      version: ApiVersion;
      companyName: string;
      adminEmail: string;
      adminName: string;
      customAuthBaseUrl?: string;
      scope?: string;
      audience?: string;
      resource?: string;
    } = req.body;

    if (
      !baseUrl ||
      !clientId ||
      !clientSecret ||
      !version ||
      !companyName ||
      !adminEmail ||
      !adminName
    ) {
      logger.error("Missing required parameters");
      res.status(400).json({ message: "Missing required parameters" });
      return;
    }

    try {
      const testRunId = randomUUID();

      await dbUtils.saveTestRun({
        testRunId,
        companyName,
        adminEmail,
        adminName,
        techSpecVersion: version,
        status: TestRunStatus.FAIL,
      });

      const authBaseUrl = customAuthBaseUrl || baseUrl;

      const oidAuthUrl = await getOidAuthUrl(authBaseUrl);

      // Add scope, audience and resource to the auth request body
      // Make sure to url encode things, otherwise it will not work
      // Only include scope, audience and resource if they are provided
      const authRequestData = new URLSearchParams({
        grant_type: "client_credentials",
        ...(scope && { scope }),
        ...(audience && { audience }),
        ...(resource && { resource }),
      }).toString();

      const accessToken = await getAccessToken(
        authBaseUrl,
        clientId,
        clientSecret,
        authRequestData,
        oidAuthUrl
      );

      const footprints = await fetchFootprints(baseUrl, accessToken, version);

      const paginationLinks = await getLinksHeaderFromFootprints(
        baseUrl,
        accessToken,
        version
      );

      dbUtils.saveTestData(testRunId, {
        productIds: footprints.data[0].productIds,
        version,
      });

      const testRunParams = {
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
        webhookUrl: config.CONFORMANCE_API,
      };

      const testCases = version.startsWith("V2")
        ? generateV2TestCases(testRunParams)
        : generateV3TestCases(testRunParams);

      const results: TestResult[] = [];

      // Run each test case sequentially.
      for (const testCase of testCases) {
        logger.info(`Running test case: ${testCase.name}`);
        const result = await runTestCase(
          baseUrl,
          testCase,
          accessToken,
          version
        );
        if (result.status === TestCaseResultStatus.SUCCESS) {
          logger.info(`Test case "${testCase.name}" passed.`);
        } else {
          logger.error(
            `Test case "${testCase.name}" failed: ${result.errorMessage}`
          );
        }
        results.push(result);
      }

      await dbUtils.saveTestCaseResults(testRunId, results);

      // Load existing test results from database to get the most up-to-date state
      const existingTestRun = await dbUtils.getTestResults(testRunId);
      const finalTestResults =
        existingTestRun?.results || results;

      // Calculate test run status and passing percentage from loaded results
      const { testRunStatus, passingPercentage, failedMandatoryTests } =
        calculateTestRunMetrics(finalTestResults);

      // Save the test run status and passing percentage to the database
      await dbUtils.updateTestRunStatus(
        testRunId,
        testRunStatus,
        passingPercentage
      );

      // If any test failed, return an error response.
      if (failedMandatoryTests.length > 0) {
        logger.error("Some tests failed:", failedMandatoryTests);
        res.status(500).json({
          message: "One or more tests failed",
          results: finalTestResults,
          passingPercentage,
          testRunId,
        });
        return;
      }

      logger.info("All tests passed successfully.");
      res.status(200).json({
        message: "All tests passed successfully",
        results: finalTestResults,
        passingPercentage,
        testRunId,
      });
      return;
    } catch (error: any) {
      logger.error("Error in Lambda function:", error);
      res.status(500).json({
        message: "Error occurred in Lambda test runner",
        error: error.message,
      });
      return;
    }
  }
}

// Create controller instance
export const testRunController = new TestRunController();

// Export route handlers
export const getTestRuns = (req: Request, res: Response) =>
  testRunController.getTestRuns(req, res);

export const searchOrGetTestRuns = (req: Request, res: Response) =>
  testRunController.searchOrGetTestRuns(req, res);

export const getTestRunById = (req: Request, res: Response) =>
  testRunController.getTestRunById(req, res);

export const createTestRun = (req: Request, res: Response) =>
  testRunController.createTestRun(req, res);
