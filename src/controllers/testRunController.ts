import { Request, Response } from "express";
import logger from "../utils/logger";
import { TestRunWorker } from "../services/test-run-worker";
import {
  TestCaseResultStatus,
  TestRunStatus,
  TestStorage,
  TestRunStartParams
} from "../services/types";
import { Services } from "../services";
import { ArgumentError } from "../utils/errors";

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

export class TestRunController {

  /**
   * GET /testruns - List all test runs
   */
  async listTestRuns(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Getting recent test runs", { query: req.query });

      const adminEmail = req.query.adminEmail as string;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.size as string) || DEFAULT_PAGE_SIZE;
      const searchTerm = (req.query.query as string || "").trim();

      if (pageSize < 1 || pageSize >= MAX_PAGE_SIZE) {
        res.status(400).json({
          error:
            `Invalid pageSize parameter. Must be a positive integer between 1 and ${MAX_PAGE_SIZE}.`,
        });
        return;
      }

      const repository = (req.app.locals.services as Services).repository;
      const testRuns = await repository.listTestRuns(adminEmail, searchTerm, page, pageSize);

      logger.info("Successfully retrieved test runs", {
        count: testRuns.length,
        adminEmail,
        searchTerm,
        page,
        pageSize,
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
   * GET /testruns/:id - Get test run details with results
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

      const repository = (req.app.locals.services as Services).repository;
      const result = await repository.getTestResults(testRunId);

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
   */
  async createTestRun(req: Request, res: Response): Promise<void> {
    try {
      const services = req.app.locals.services as Services;
      const testrun = await services.worker.execute(req.body as TestRunStartParams);
      if (testrun.status === TestRunStatus.PASS) {
        res.status(200).json({
          message: "All tests passed successfully",
          testRunId: testrun.testRunId,
          status: testrun.status,
          passingPercentage: testrun.passingPercentage,
          results: testrun.results,
        }) 
      } else {
        res.status(500).json({
          message: "One or more tests failed",
          testRunId: testrun.testRunId,
          status: testrun.status,
          passingPercentage: testrun.passingPercentage,
          results: testrun.results,
        })
      }
      return;
    } catch (error: any) {
      logger.error("Error TestRunController function:", error);
      if (error instanceof ArgumentError) {
        res.status(400).json({
          message: "Invalid request",
          error: error.message,
        });
        return;
      }
      res.status(500).json({
        message: "Error occurred in TestRunController",
        error: error.message,
      });
      return;
    }
  }
}

// Create controller instance
export const testRunController = new TestRunController();

// Export route handlers
export const listTestRuns = (req: Request, res: Response) =>
  testRunController.listTestRuns(req, res);

export const getTestRunById = (req: Request, res: Response) =>
  testRunController.getTestRunById(req, res);

export const createTestRun = (req: Request, res: Response) =>
  testRunController.createTestRun(req, res);
