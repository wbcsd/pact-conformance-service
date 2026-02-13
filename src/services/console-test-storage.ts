import logger from "../utils/logger";
import {
  TestStorage,
  TestData,
  TestResult,
  TestRunWithResults,
  TestRun,
  TestCaseResultStatus,
  PagingParameters,
} from "./types";

/**
 * Console-based implementation of TestStorage that displays results
 * to the console instead of persisting them to a database.
 * Useful for running tests from the command line without needing a database.
 */
export class ConsoleTestStorage implements TestStorage {
  private testRunData: Map<string, TestRun> = new Map();
  private testResults: Map<string, TestResult[]> = new Map();
  private testData: Map<string, TestData> = new Map();

  async saveTestRun(details: Omit<TestRun, "timestamp">): Promise<void> {
    const testRun: TestRun = {
      ...details,
      timestamp: new Date().toISOString(),
    };
    this.testRunData.set(testRun.testRunId, testRun);
    
    logger.info("=".repeat(80));
    logger.info(`Test Run: ${testRun.testRunId}`);
    logger.info(`Organization: ${testRun.organizationName}`);
    logger.info(`Tech Spec Version: ${testRun.techSpecVersion}`);
    logger.info("=".repeat(80));
  }

  async updateTestRunStatus(
    testRunId: string,
    status: string,
    passingPercentage: number
  ): Promise<void> {
    const testRun = this.testRunData.get(testRunId);
    if (testRun) {
      testRun.status = status;
      testRun.passingPercentage = passingPercentage;
    }
    
    logger.info("\n" + "=".repeat(80));
    logger.info(`Test Run Completed: ${status}`);
    logger.info(`Passing Percentage: ${passingPercentage}%`);
    logger.info("=".repeat(80));
  }

  async saveTestCaseResult(
    testRunId: string,
    testResult: TestResult,
    overwriteExisting: boolean
  ): Promise<void> {
    const results = this.testResults.get(testRunId) || [];
    
    if (!overwriteExisting) {
      const existing = results.find((r) => r.testKey === testResult.testKey);
      if (existing) {
        return;
      }
    } else {
      const index = results.findIndex((r) => r.testKey === testResult.testKey);
      if (index >= 0) {
        results[index] = testResult;
        this.testResults.set(testRunId, results);
        return;
      }
    }
    
    results.push(testResult);
    this.testResults.set(testRunId, results);
  }

  async saveTestCaseResults(
    testRunId: string,
    testResults: TestResult[]
  ): Promise<void> {
    for (const testResult of testResults) {
      await this.saveTestCaseResult(testRunId, testResult, false);
    }
    
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

  async getTestResults(testRunId: string): Promise<TestRunWithResults | null> {
    const testRun = this.testRunData.get(testRunId);
    const results = this.testResults.get(testRunId) || [];
    
    if (!testRun) {
      return null;
    }
    
    return {
      ...testRun,
      results,
    };
  }

  async saveTestData(testRunId: string, testData: TestData): Promise<void> {
    this.testData.set(testRunId, testData);
    logger.info(`Test data saved for product IDs: ${testData.productIds.join(", ")}`);
  }

  async getTestData(testRunId: string): Promise<TestData | null> {
    return this.testData.get(testRunId) || null;
  }

  async listTestRuns(
    paging: PagingParameters,
    adminEmail?: string
  ): Promise<TestRun[]> {
    // For console storage, just return all test runs
    return Array.from(this.testRunData.values());
  }
}
