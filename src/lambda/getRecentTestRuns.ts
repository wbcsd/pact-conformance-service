import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DatabaseFactory, DatabaseType } from "../data/factory";
import { TestRunStatus } from "../types/types";
import { getTestResults } from "../utils/dbUtils";

const MAX_TEST_RUNS_TO_ENRICH = 10;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const adminEmail = event.queryStringParameters?.adminEmail;

    if (!adminEmail) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Missing required query parameter: adminEmail",
        }),
      };
    }

    const dbType = (process.env.DATABASE_TYPE || 'dynamodb') as DatabaseType;
    const database = DatabaseFactory.create(dbType);

    // Get recent test runs for the specified email
    const testRuns = await database.getRecentTestRunsByEmail(
      adminEmail,
      MAX_TEST_RUNS_TO_ENRICH
    );

    // Enrich the test runs with status information
    const enrichedTestRuns = await Promise.all(
      testRuns.map(async (testRun) => {
        // Get test results for this test run
        const testResults = await getTestResults(testRun.testId);

        // Calculate status based on mandatory tests
        let status = TestRunStatus.PASS;

        // If there are no test results, mark as FAIL as no tests were run
        if (testResults.results.length === 0) {
          status = TestRunStatus.FAIL;
        }

        // If there are mandatory tests and any of them failed, mark as FAIL
        const mandatoryTests = testResults.results.filter(
          (result) => result.mandatory
        );
        if (mandatoryTests.length > 0) {
          const failedMandatoryTests = mandatoryTests.filter(
            (result) => !result.success
          );
          if (failedMandatoryTests.length > 0) {
            status = TestRunStatus.FAIL;
          }
        }

        return {
          ...testRun,
          status,
        };
      })
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        totalCount: testRuns.length,
        returnedCount: enrichedTestRuns.length,
        testRuns: enrichedTestRuns,
      }),
    };
  } catch (error) {
    console.error("Error retrieving test runs:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? String(error) : undefined,
      }),
    };
  }
};
