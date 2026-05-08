import logger from "../utils/logger";
import { TestRunStartParams, TestRunWithResults, TestStorage, TestCaseResultStatus, ApiVersion, TestRun, TestRunStatus } from "./types";
import { V3Tests } from "../test-cases/v3-tests";
import { ListenerContext, TestDefinition, runTest, runListenerTest, TestContext } from "../test-cases/test-helpers";
import { BadRequestError } from "../errors";
import { getSchema } from "../schemas";
import { V2Tests } from "../test-cases/v2-tests";
import { randomUUID } from "crypto";
import { Request } from "express";


export class TestRunWorkerNew {

  constructor(private output: TestStorage) {
  }

  /**
   * Executes a test run using the imperative test functions from V3Tests or V2Tests.
   *
   * Init tests (isInit: true) are always run first, in definition order, regardless of any
   * testCaseNumbers filter. Each populates the shared TestContext and produces a tracked
   * TestResult. If any init test fails, execution stops and no regular tests run.
   *
   * Regular tests are optionally filtered by testCaseNumbers before running sequentially.
   */
  async startTestRun(params: TestRunStartParams): Promise<TestRunWithResults> {

    logger.info(`Start test run: ${params.baseUrl}`);

    // Normalize URLs
    params.baseUrl = params.baseUrl.replace(/\/+$/, "").replace(/^https:/i, "https:");
    params.customAuthBaseUrl = params.customAuthBaseUrl?.replace(/\/+$/, "").replace(/^https:/i, "https:");

    // Create the test run record with initial FAIL status (updated to final status after all tests complete)
    const testRun: TestRun = {
      testRunId: randomUUID(),
      ...params,
      timestamp: new Date().toISOString(),
      techSpecVersion: params.version,
      status: TestRunStatus.FAIL,
      data: null,
    };

    // Load the schema for this test run's API version, which will be shared across all tests in this run
    const schema = await getSchema(params.version);

    // Create a bare TestContext; init tests are responsible for populating it
    const context = new TestContext(testRun, params, schema);

    // Save the initial test run record before executing tests, so we have a record of it even if setup fails
    await this.output.saveTestRun(testRun);

    // Partition all tests into init tests and regular tests
    const allTests: TestDefinition[] = Object.values(testRun.techSpecVersion.startsWith("V3") ? V3Tests : V2Tests);
    const initTests = allTests.filter((t) => t.isInit === true);
    const regularTests = allTests.filter((t) => !t.isInit);

    // Run all init tests sequentially; abort on first failure
    const results: any[] = [];
    for (const test of initTests) {
      const result = await runTest(test, context);
      results.push(result);
      if (result.status === TestCaseResultStatus.SUCCESS) {
        // Re-save testRun after each successful init test so that any data written to
        // testRun (e.g. productIds) is persisted before async callback tests read it
        await this.output.saveTestRun(testRun);
      } else {
        logger.error(`Init test "${test.testName}" failed: ${result.errorMessage}. Aborting test run.`);
        await this.output.saveTestCaseResults(testRun.testRunId, results, false);
        await this.output.updateTestRunStatus(testRun.testRunId);
        return await this.output.getTestRunWithResults(testRun.testRunId);
      }
    }

    // Apply testCaseNumbers filter only to regular tests
    let testsToRun = regularTests;
    if (params.testCaseNumbers?.length) {
      const allowed = new Set(params.testCaseNumbers);
      testsToRun = regularTests.filter((t) => t.testNumber !== null && allowed.has(t.testNumber));
      logger.info(`Filtered to test cases: ${params.testCaseNumbers.join(", ")} (${testsToRun.length} cases)`);
    }

    // Run regular tests sequentially
    for (const test of testsToRun) {
      const result = test.action
        ? await runTest(test, context)
        : { status: TestCaseResultStatus.PENDING, testKey: test.testKey, name: test.testName, mandatory: test.optional?.includes(params.version) ? false : true, };
      if (result.status !== TestCaseResultStatus.SUCCESS) {
        logger.error(`Test case "${test.testName}" failed: ${result.errorMessage}`);
      }
      results.push(result);
    }

    // Save results and update overall status
    await this.output.saveTestCaseResults(testRun.testRunId, results, false);
    await this.output.updateTestRunStatus(testRun.testRunId);

    return await this.output.getTestRunWithResults(testRun.testRunId);
  }

  /**
   * Handles incoming callback events for test cases. The requestEventId is used to
   * correlate the event to a specific test run and test case.
   * @param eventPayload The payload of the event received.
   * @param requestPath The path of the request that triggered the event.
   * @returns A promise that resolves when the event has been processed.
   */
  async handleCallback(request: Request): Promise<void> {
    // Validate event payload
    if (!request.body) {
      throw new BadRequestError("Request body is missing");
    }
    if (!request.body.data?.requestEventId) {
      throw new BadRequestError("Missing requestEventId in event data");
    }
    logger.info("Processing event:", { path: request.path, type: request.body.type, requestEventId: request.body.data.requestEventId });

    const [ testRunId, testKey ] = request.body.data.requestEventId.split('/');
    
    // Will throw an error if not found
    const testRun = await this.output.getTestRun(testRunId);
    
    const tests = testRun.techSpecVersion.startsWith("V2") ? V2Tests : V3Tests;

    // Find the corresponding test case for this event using the testKey, which encodes the test case number
    const test = Object.values(tests).find((t) => t.testKey === "TESTCASE#" + testKey);
    if (!test) {
      throw new BadRequestError(`No test found for testKey ${testKey} in event ${request.body.data.requestEventId}`);
    }
    if (!test.listener) {
      throw new BadRequestError(`No listener found for testKey ${testKey} in event ${request.body.data.requestEventId}`);
    }

    // Create a ListenerContext for this event, which provides helper functions and shared data for listener tests
    const context = new ListenerContext(
      testRun,
      testRun.techSpecVersion as ApiVersion,
      request.path,
      request.method,
      request.headers as Record<string, string>,
      request.body,
      await getSchema(testRun.techSpecVersion),
    );

    // Log the received event and its correlation to the test case before executing the listener
    context.info(`Received event ${request.body.data.requestEventId} for test case ${test.testKey}`);

    // Construct full url for logging purposes, since request.url only contains the path and query string
    const fullUrl = `${request.protocol}://${request.get("host")}${request.originalUrl}`; 
    context.logRequest(request.method, fullUrl, request.headers as Record<string, string>, request.body);
    
    // Run the test
    const result = await runListenerTest(test, context);

    // Save this test result, changing it from PEMNDING to eiter SUCCESS or FAILURE, 
    // and then update the overall test run status accordingly.   
    await this.output.saveTestCaseResults(testRunId, [result], true);
    await this.output.updateTestRunStatus(testRunId);
  }
}
