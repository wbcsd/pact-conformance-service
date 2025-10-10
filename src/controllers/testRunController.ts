import { Request, Response } from "express";
import logger from "../utils/logger";
import {
  TestRunStatus,
  TestRunStartParams,
} from "../services/types";
import { Services } from "../services";
import { ValidationError, NotFoundError } from "../errors";

export class TestRunController {

  /**
   * GET /testruns - List all test runs
   */
  async listTestRuns(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Getting recent test runs", { query: req.query });

      const services = req.app.locals.services as Services;
      const adminEmail = req.query.adminEmail as string;

      const testRuns = await services.repository.listTestRuns(req.query, adminEmail);

      res.status(200).json({ 
        testRuns, 
        count: testRuns.length
      });

    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          error: error.message,
        });
        return;
      }
      
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

      const repository = (req.app.locals.services as Services).repository;
      const result = await repository.getTestResultsWithPercentages(testRunId);

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          error: error.message,
        });
        return;
      }
      
      if (error instanceof NotFoundError) {
        res.status(404).json({
          error: error.message,
        });
        return;
      }
      
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
      const testrun = await services.worker.startTestRun(req.body as TestRunStartParams);
      
      if (testrun.status === TestRunStatus.PASS) {
        res.status(200).json({
          message: "All tests passed successfully",
          testRunId: testrun.testRunId,
          status: testrun.status,
          passingPercentage: testrun.passingPercentage,
          results: testrun.results,
        });
      } else {
        res.status(500).json({
          message: "One or more tests failed",
          testRunId: testrun.testRunId,
          status: testrun.status,
          passingPercentage: testrun.passingPercentage,
          results: testrun.results,
        });
      }
    } catch (error: any) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          message: "Invalid request",
          error: error.message,
        });
        return;
      }
      
      logger.error("Error in TestRunController:", error);
      res.status(500).json({
        message: "Error occurred in TestRunController",
        error: error.message,
      });
    }
  }
}

// Create controller instance
export const testRunController = new TestRunController();

// // Export route handlers
// export const listTestRuns = (req: Request, res: Response) =>
//   testRunController.listTestRuns(req, res);

export const getTestRunById = (req: Request, res: Response) =>
  testRunController.getTestRunById(req, res);

export const createTestRun = (req: Request, res: Response) =>
  testRunController.createTestRun(req, res);
