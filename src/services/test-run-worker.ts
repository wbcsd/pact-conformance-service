import { randomUUID } from "crypto";
import config from "../config";
import logger from "../utils/logger";
import { ValidationError } from "../errors";
import { TestRunStartParams, TestRunWithResults, TestStorage } from "./types";
import { TestCaseResultStatus, TestResult, TestRunStatus } from "./types";
import { calculateTestRunMetrics } from "../utils/testRunMetrics";
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
    
    // Implementation of the test run execution logic goes here.
    // This would include setting up the test environment,
    // running the tests, collecting results, and updating the test run status.

    const testRunId = randomUUID();
    logger.info(`Executing test run ${testRunId} for organization ${params.organizationName}`);
    logger.info(`Test run parameters: ${JSON.stringify(params)}`);

    if (!params.baseUrl || !params.clientId || !params.clientSecret) {
      throw new ValidationError("Missing required parameters: baseUrl, clientId, and clientSecret are mandatory.");
    }
    await this.output.saveTestRun({
      testRunId,
      ...params,
      organizationName: params.organizationName,
      techSpecVersion: params.version, 
      status: TestRunStatus.FAIL,
    });

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

    this.output.saveTestData(testRunId, {
      productIds: footprints.data[0].productIds,
      version: params.version,
    });

    const testRunParams = {
      testRunId,
      footprints,
      paginationLinks,
      ...params,
      authTokenUrl,
      authRequestData,
      webhookUrl: config.CONFORMANCE_API,
    };

    // Generate test cases based on the version
    const testCases = params.version.startsWith("V2")
      ? generateV2TestCases(testRunParams)
      : generateV3TestCases(testRunParams);

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

    // Store test cases results.
    await this.output.saveTestCaseResults(testRunId, results);

    // Load existing test results from database to get the most up-to-date state, also 
    // from the asynchronous webhook updates.
    const latestResults = (await this.output.getTestResults(testRunId))?.results;

    const testRun: TestRunWithResults = {
      testRunId,
      organizationName: params.organizationName,
      adminEmail: params.adminEmail,
      adminName: params.adminName,
      timestamp: new Date().toISOString(),
      status: TestRunStatus.FAIL,
      techSpecVersion: params.version,
      results: latestResults ?? results
    }

    // Calculate test run status and passing percentage from loaded results
    const { testRunStatus, passingPercentage, failedMandatoryTests } =
      calculateTestRunMetrics(testRun.results);

    // Save the test run status and passing percentage to the database
    await this.output.updateTestRunStatus(
      testRunId,
      testRunStatus,
      passingPercentage
    );

    testRun.status = testRunStatus;
    testRun.passingPercentage = passingPercentage;
    return testRun;
  }
}