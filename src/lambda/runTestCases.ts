import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { ApiVersion, TestResult, TestResultStatus } from "../types/types";
import { getAccessToken, getOidAuthUrl } from "../utils/authUtils";
import { generateV2TestCases } from "../test-cases/v2-test-cases";
import {
  fetchFootprints,
  getLinksHeaderFromFootprints,
  sendCreateRequestEvent,
} from "../utils/fetchFootprints";
import { runTestCase } from "../utils/runTestCase";
import {
  saveTestCaseResults,
  saveTestData,
  saveTestRun,
} from "../utils/dbUtils";
import { generateV3TestCases } from "../test-cases/v3-test-cases";

const WEBHOOK_URL = process.env.WEBHOOK_URL || "";

/**
 * Lambda handler that runs the test scenarios.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const {
    baseUrl,
    clientId,
    clientSecret,
    version,
    companyName,
    adminEmail,
    adminName,
    customAuthBaseUrl,
  }: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    version: ApiVersion;
    companyName: string;
    adminEmail: string;
    adminName: string;
    customAuthBaseUrl?: string;
  } = JSON.parse(event.body || "{}");

  if (
    !baseUrl ||
    !clientId ||
    !clientSecret ||
    !version ||
    !companyName ||
    !adminEmail ||
    !adminName
  ) {
    console.error("Missing required parameters");
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Missing required parameters",
      }),
    };
  }

  try {
    const testRunId = randomUUID();

    await saveTestRun({
      testRunId,
      companyName,
      adminEmail,
      adminName,
      techSpecVersion: version,
    });

    const authBaseUrl = customAuthBaseUrl || baseUrl;

    const oidAuthUrl = await getOidAuthUrl(authBaseUrl);

    const accessToken = await getAccessToken(
      authBaseUrl,
      clientId,
      clientSecret,
      oidAuthUrl
    );

    const footprints = await fetchFootprints(baseUrl, accessToken, version);

    const paginationLinks = await getLinksHeaderFromFootprints(
      baseUrl,
      accessToken,
      version
    );

    saveTestData(testRunId, {
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
      version,
      webhookUrl: WEBHOOK_URL,
    };

    const testCases = version.startsWith("V2")
      ? generateV2TestCases(testRunParams)
      : generateV3TestCases(testRunParams);

    const results: TestResult[] = [];

    // Run each test case sequentially.
    for (const testCase of testCases) {
      console.log(`Running test case: ${testCase.name}`);
      const result = await runTestCase(baseUrl, testCase, accessToken, version);
      if (result.success) {
        console.log(`Test case "${testCase.name}" passed.`);
      } else {
        console.error(
          `Test case "${testCase.name}" failed: ${result.errorMessage}`
        );
      }
      results.push(result);
    }

    // Send create request event for the async create request rejected test case.
    await sendCreateRequestEvent(
      baseUrl,
      accessToken,
      version,
      ["urn:pact:null"], // SPs will be instructed to reject a request with null productIds
      testRunId,
      WEBHOOK_URL
    );

    const resultsWithAsyncPlaceholder: TestResult[] = [
      ...results,
      {
        name: "Test Case 13: Respond to Asynchronous PCF Request",
        status: TestResultStatus.PENDING,
        success: false,
        mandatory: version === "V2.3" || version === "V3.0",
        testKey: "TESTCASE#13",
        documentationUrl: version.startsWith("V2")
          ? "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v2-test-cases-expected-results.md#test-case-13-respond-to-pcf-request-fulfilled-event"
          : "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v3-test-cases-expected-results.md#test-case-13-respond-to-pcf-request-fulfilled-event",
      },
      {
        name: "Test Case 14: Handle Rejected PCF Request",
        status: TestResultStatus.PENDING,
        success: false,
        mandatory: version === "V2.3" || version === "V3.0",
        testKey: "TESTCASE#14",
        documentationUrl: version.startsWith("V2")
          ? "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v2-test-cases-expected-results.md#test-case-14-respond-to-pcf-request-rejected-event"
          : "https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v3-test-cases-expected-results.md#test-case-14-respond-to-pcf-request-rejected-event",
      },
    ];

    await saveTestCaseResults(testRunId, resultsWithAsyncPlaceholder);

    // If any test failed, return an error response.
    const mandatoryFailedTests = resultsWithAsyncPlaceholder.filter(
      (result) => result.mandatory && !result.success
    );

    if (mandatoryFailedTests.length > 0) {
      console.error("Some tests failed:", mandatoryFailedTests);
      // Filter out optional tests for passing percentage calculation
      const mandatoryTests = resultsWithAsyncPlaceholder.filter(
        (result) => result.mandatory
      );
      const failedMandatoryTests = mandatoryTests.filter(
        (result) => !result.success
      );

      const passingPercentage =
        mandatoryTests.length > 0
          ? Math.round(
              ((mandatoryTests.length - failedMandatoryTests.length) /
                mandatoryTests.length) *
                100
            )
          : 0;

      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "One or more tests failed",
          results: resultsWithAsyncPlaceholder,
          passingPercentage,
          testRunId,
        }),
      };
    }

    console.log("All tests passed successfully.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "All tests passed successfully",
        results: resultsWithAsyncPlaceholder,
        passingPercentage: 100,
        testRunId,
      }),
    };
  } catch (error: any) {
    console.error("Error in Lambda function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error occurred in Lambda test runner",
        error: error.message,
      }),
    };
  }
};
