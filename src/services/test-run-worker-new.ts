import logger from "../utils/logger";
import { TestRunStartParams, TestRunWithResults, TestStorage, TestCaseResultStatus, EventTypesV3, ApiVersion } from "./types";
import { initTestContext } from "./init-test-context";
import { V3Tests } from "../test-cases/v3-tests";
import { ListenerContext, TestDefinition } from "../test-cases/test-helpers";
import { BadRequestError } from "../errors";
import { getSchema } from "../schemas";
import { V2Tests } from "../test-cases/v2-tests";


export class TestRunWorkerNew {

  constructor(private output: TestStorage) {
  }

  /**
   * Executes a V3 test run using the imperative test functions from V3Tests.
   *
   * Uses initTestContext() for all setup (auth, footprints, schema, etc.)
   * then iterates over V3Tests, optionally filtering by test case number.
   */
  async startTestRun(params: TestRunStartParams): Promise<TestRunWithResults> {

    logger.info(`Start test run (NEW): ${params.baseUrl}`);

    const { testRun, context } = await initTestContext(params);
    await this.output.saveTestRun(testRun);

    // Collect all test functions with their metadata
    let tests: TestDefinition[] = Object.values(context.version.startsWith("V3") ? V3Tests : V2Tests);

    // Filter to specific test case numbers if requested
    if (params.testCaseNumbers?.length) {
      const allowed = new Set(params.testCaseNumbers);
      tests = tests.filter((fn) => fn.testNumber !== null && allowed.has(fn.testNumber));
      logger.info(`Filtered to test cases: ${params.testCaseNumbers.join(", ")} (${tests.length} cases)`);
    }

    // Run each test sequentially
    const results = [];
    for (const test of tests) {
      logger.info(`Running test case: ${test.testName}`);
      const result = test.action ? await test.action(context) : { status: TestCaseResultStatus.PENDING, testKey: test.testKey, name: test.testName, mandatory: true };
      if (result.status === TestCaseResultStatus.SUCCESS) {
        logger.info(`Test case "${test.testName}" passed.`);
      } else {
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
  async handleCallback(eventPayload: any, requestPath: string): Promise<void> {
    // Validate event payload
    if (!eventPayload) {
      throw new BadRequestError("Request body is missing");
    }
    if (!eventPayload.data?.requestEventId) {
      throw new BadRequestError("Missing requestEventId in event data");
    }
    logger.info("Processing event:", { path: requestPath, type: eventPayload.type, requestEventId: eventPayload.data.requestEventId });

    const [ testRunId, testKey ] = eventPayload.data.requestEventId.split('/');
    
    // Will throw an error if not found
    const testRun = await this.output.getTestRun(testRunId);
    
    const keys = Object.values(V3Tests).flatMap((test) => test.testKey);
    logger.info('Available test keys:', keys);

    const test = Object.values(V3Tests).find((t) => t.testKey === "TESTCASE#" + testKey);
    if (!test) {
      logger.error(`No test found for testKey ${testKey} in event ${eventPayload.data.requestEventId}`);
      return; 
    }
    if (!test.listener) {
      logger.error(`No listener found for testKey ${testKey} in event ${eventPayload.data.requestEventId}`);
      return; 
    }
    const context: ListenerContext = {
      testRun,
      version: testRun.techSpecVersion as ApiVersion,
      path: requestPath,
      method: "POST",
      headers: {}, // We could enhance this to pass actual headers if needed
      data: eventPayload,
      schema: await getSchema(testRun.techSpecVersion)
    };
    const result = await test.listener(context);

    // Save this test result, changing it from PEMNDING to eiter SUCCESS or FAILURE, 
    // and then update the overall test run status accordingly.   
    await this.output.saveTestCaseResults(testRunId, [result], true);
    await this.output.updateTestRunStatus(testRunId);
  }
}
