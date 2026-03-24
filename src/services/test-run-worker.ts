import { randomUUID } from "crypto";
import config from "../config";
import logger from "../utils/logger";
import { ValidationError } from "../errors";
import { TestRunStartParams, TestRun, TestRunWithResults, TestStorage } from "./types";
import { TestCaseResultStatus, TestResult, TestRunStatus } from "./types";
import { fetchFootprints, getLinksHeaderFromFootprints } from "../utils/fetchFootprints";
import { getAccessToken, fetchOpenIdTokenEndpoint } from "../utils/authUtils";
import { generateV3TestCases } from "../test-cases/v3-test-cases";
import { generateV2TestCases } from "../test-cases/v2-test-cases";
import { runTestCase } from "../utils/runTestCase";


export class TestRunWorker {

  constructor(private output: TestStorage) {
  }

  /**
   * Executes a test run based on the provided parameters.
   *
   * This method sets up the test environment, obtains authentication tokens,
   * fetches required product footprints, generates test cases according to the specified version,
   * runs each test case sequentially, collects results, and updates the test run status.
   * It also handles saving and updating test run data and results in the output storage.
   *
   */
  async startTestRun(params: TestRunStartParams): Promise<TestRunWithResults> {
    
    if (!params.baseUrl || !params.clientId || !params.clientSecret) {
      throw new ValidationError("Missing required parameters: baseUrl, clientId, and clientSecret are mandatory.");
    }

    // Initialize the test run in the storage with status "FAIL" and then update it 
    // to "PASS" or "FAIL" or "PENDING" based on the results after execution.
    const testRun: TestRun = {
      testRunId: randomUUID(),
      ...params,
      timestamp: new Date().toISOString(),
      techSpecVersion: params.version,
      status: TestRunStatus.FAIL, 
      data: null, // Initialize data as null, will be updated later with productIds
    }

    logger.info(`Executing test run ${testRun.testRunId} for organization ${params.organizationName}`);
    logger.info(`Test run parameters: ${JSON.stringify(params)}`);

    // Remove trailing slashes from URLs, and lowercase protocol part for http/https tests to work correctly
    params.baseUrl = params.baseUrl.replace(/\/+$/, "").replace(/^https:/i, "https:");
    params.customAuthBaseUrl = params.customAuthBaseUrl?.replace(/\/+$/, "").replace(/^https:/i, "https:");
    
    await this.output.saveTestRun(testRun);

    // Obtain token endpoint from .well-known if available
    const authTokenUrl = await fetchOpenIdTokenEndpoint(params.customAuthBaseUrl ?? params.baseUrl) ??
      `${params.customAuthBaseUrl || params.baseUrl}/auth/token`;

    // Add scope, audience and resource to the auth request body
    // Make sure to url encode things, otherwise it will not work
    // Only include scope, audience and resource if they are provided
    const authRequestData = new URLSearchParams({
      grant_type: "client_credentials",
      ...(params.scope && { scope: params.scope }),
      ...(params.audience && { audience: params.audience }),
      ...(params.resource && { resource: params.resource }),
    }).toString();

    // Obtain access token from auth endpoint
    const accessToken = await getAccessToken(
      authTokenUrl,
      params.clientId,
      params.clientSecret,
      authRequestData
    );

    // Obtain a list of productIds from the /footprints endpoint. We need at 
    // least one productId to run the tests against.
    const footprints = await fetchFootprints(params.baseUrl, accessToken, params.version);

    const paginationLinks = await getLinksHeaderFromFootprints(
      params.baseUrl,
      accessToken,
      params.version
    );
    testRun.data = { productIds: footprints.data[0].productIds } 
    await this.output.saveTestRun(testRun);

    const testRunParams = {
      testRunId: testRun.testRunId,
      footprints,
      paginationLinks,
      ...params,
      authTokenUrl,
      authRequestData,
      webhookUrl: config.CONFORMANCE_API,
    };

    // Generate test cases based on the version
    let testCases = params.version.startsWith("V2")
      ? await generateV2TestCases(testRunParams)
      : await generateV3TestCases(testRunParams);

    // Filter to specific test case numbers if requested (e.g. testKey "TESTCASE#1" -> 1)
    if (params.testCaseNumbers?.length) {
      const allowed = new Set(params.testCaseNumbers);
      testCases = testCases.filter((tc) => {
        const match = tc.testKey.match(/^TESTCASE#(\d+)/);
        const num = match ? parseInt(match[1], 10) : null;
        return num !== null && allowed.has(num);
      });
      logger.info(`Filtered to test cases: ${params.testCaseNumbers.join(", ")} (${testCases.length} cases)`);
    }

    const results: TestResult[] = [];

    // Run each test case sequentially.
    for (const testCase of testCases) {
      logger.info(`Running test case: ${testCase.name}`);
      const result = await runTestCase(
        params.baseUrl,
        testCase,
        accessToken,
        params.version
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

    // Save the test case results and then update the overall test run status accordingly.   
    await this.output.saveTestCaseResults(testRun.testRunId, results, false);
    await this.output.updateTestRunStatus(testRun.testRunId);

    // Load existing test results from database to get the most up-to-date state, also 
    // from the asynchronous webhook updates.
    return await this.output.getTestRunWithResults(testRun.testRunId); 
  }
}