import { NotFoundError } from "../errors";
import logger from "../utils/logger";
import {
  TestStorage,
  TestResult,
  TestRunWithResults,
  TestRun,
  TestCaseResultStatus,
  PagingParameters,
  TestRunStatus,
} from "./types";

/**
 * Console-based implementation of TestStorage that displays results
 * to the console instead of persisting them to a database.
 * Useful for running tests from the command line without needing a database.
 */
export class ConsoleTestStorage implements TestStorage {
  private testRunData: Map<string, TestRun> = new Map();
  private testResults: Map<string, TestResult[]> = new Map();

  async saveTestRun(testRun: TestRun): Promise<void> {
    this.testRunData.set(testRun.testRunId, testRun);
    
    logger.info("=".repeat(80));
    logger.info(`Test Run: ${testRun.testRunId}`);
    logger.info(`Organization: ${testRun.organizationName}`);
    logger.info(`Tech Spec Version: ${testRun.techSpecVersion}`);
    logger.info("=".repeat(80));
  }

  async getTestRun(testRunId: string): Promise<TestRun> {
    const testRun = this.testRunData.get(testRunId);
    
    if (!testRun) {
      throw new NotFoundError(`Test run with ID ${testRunId} not found`);
    }
    return testRun;
  }

  async updateTestRunStatus(testRunId: string): Promise<void> {
    const testRun = await this.getTestRunWithResults(testRunId);
    const mandatoryTests = testRun.results.filter(
      (test) => test.mandatory
    );
    const failedMandatoryTests = mandatoryTests.filter(
      (test) => test.status === TestCaseResultStatus.FAILURE
    );
    const pendingMandatoryTests = mandatoryTests.filter(
      (test) => test.status === TestCaseResultStatus.PENDING
    );
    if (mandatoryTests.length > 0 && failedMandatoryTests.length === 0 && pendingMandatoryTests.length === 0) {
      testRun.status = TestRunStatus.PASS;
      testRun.passingPercentage = 100;
    } else if (failedMandatoryTests.length > 0) {
      testRun.status = TestRunStatus.FAIL;
      testRun.passingPercentage = Math.round(((mandatoryTests.length - failedMandatoryTests.length - pendingMandatoryTests.length) / mandatoryTests.length) * 100);
    } else if (pendingMandatoryTests.length > 0) {
      testRun.status = TestRunStatus.PENDING;
      testRun.passingPercentage = Math.round(((mandatoryTests.length - pendingMandatoryTests.length) / mandatoryTests.length) * 100);
    }
  }

  async saveTestCaseResults(
    testRunId: string,
    testResults: TestResult[],
    overwriteExisting: boolean
  ): Promise<void> {
    const results = this.testResults.get(testRunId) || [];
    
    for (const testResult of testResults) {
      if (!overwriteExisting) {
        const existing = results.find((r) => r.testKey === testResult.testKey);
        if (existing) {
          continue;
        }
      } else {
        const index = results.findIndex((r) => r.testKey === testResult.testKey);
        if (index >= 0) {
          results[index] = testResult;
          continue;
        }
      }
      
      results.push(testResult);
    }
    
    this.testResults.set(testRunId, results);
    
    // Display results summary
    this.displayTestResults(testResults);
  }

  private displayTestResults(results: TestResult[]): void {
    logger.info("\n" + "=".repeat(80));
    logger.info("TEST RESULTS SUMMARY");
    logger.info("=".repeat(80));
    
    const mandatoryTests = results.filter((r) => r.mandatory);
    const nonMandatoryTests = results.filter((r) => !r.mandatory);
    
    // Display mandatory tests
    logger.info("\nMandatory Tests:");
    logger.info("-".repeat(80));
    this.displayTestGroup(mandatoryTests);
    
    // Display non-mandatory tests
    if (nonMandatoryTests.length > 0) {
      logger.info("\nNon-Mandatory Tests:");
      logger.info("-".repeat(80));
      this.displayTestGroup(nonMandatoryTests);
    }
    
    // Display summary statistics
    const passed = results.filter((r) => r.status === TestCaseResultStatus.SUCCESS).length;
    const failed = results.filter((r) => r.status === TestCaseResultStatus.FAILURE).length;
    const pending = results.filter((r) => r.status === TestCaseResultStatus.PENDING).length;
    
    const mandatoryPassed = mandatoryTests.filter((r) => r.status === TestCaseResultStatus.SUCCESS).length;
    const mandatoryFailed = mandatoryTests.filter((r) => r.status === TestCaseResultStatus.FAILURE).length;
    
    logger.info("\n" + "=".repeat(80));
    logger.info("STATISTICS");
    logger.info("=".repeat(80));
    logger.info(`Total Tests: ${results.length}`);
    logger.info(`  ✓ Passed: ${passed}`);
    logger.info(`  ✗ Failed: ${failed}`);
    logger.info(`  ⧗ Pending: ${pending}`);
    logger.info(`\nMandatory Tests: ${mandatoryTests.length}`);
    logger.info(`  ✓ Passed: ${mandatoryPassed} (${mandatoryTests.length > 0 ? Math.round((mandatoryPassed / mandatoryTests.length) * 100) : 0}%)`);
    logger.info(`  ✗ Failed: ${mandatoryFailed}`);
    logger.info("=".repeat(80) + "\n");
  }

  private displayTestGroup(tests: TestResult[]): void {
    for (const result of tests) {
      const icon = result.status === TestCaseResultStatus.SUCCESS 
        ? "✓" 
        : result.status === TestCaseResultStatus.FAILURE 
        ? "✗" 
        : "⧗";
      
      const statusColor = result.status === TestCaseResultStatus.SUCCESS 
        ? "\x1b[32m" // green
        : result.status === TestCaseResultStatus.FAILURE 
        ? "\x1b[31m" // red
        : "\x1b[33m"; // yellow
      
      const resetColor = "\x1b[0m";
      
      logger.info(`${statusColor}${icon}${resetColor} ${result.name}`);
      
      if (result.errorMessage) {
        logger.info(`  Error: ${result.errorMessage}`);
      }
      
      if (result.status === TestCaseResultStatus.FAILURE && result.curlRequest) {
        logger.info(`  Request: ${result.curlRequest}`);
      }
    }
  }

  async getTestRunWithResults(testRunId: string): Promise<TestRunWithResults> {
    const testRun = this.testRunData.get(testRunId);
    const results = this.testResults.get(testRunId) || [];
    
    if (!testRun) {
      throw new NotFoundError(`Test run with ID ${testRunId} not found`);
    }
    
    return {
      ...testRun,
      results,
    };
  }

  async listTestRuns(
    paging: PagingParameters,
    adminEmail?: string
  ): Promise<TestRun[]> {
    // For console storage, just return all test runs
    return Array.from(this.testRunData.values());
  }
}
