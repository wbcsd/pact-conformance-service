import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DatabaseFactory, DatabaseType } from "../data/factory";
import { TestRunStatus } from "../types/types";
import { getTestResults } from "../utils/dbUtils";

const MAX_TEST_RUNS_TO_FETCH = process.env.MAX_TEST_RUNS_TO_FETCH
  ? parseInt(process.env.MAX_TEST_RUNS_TO_FETCH)
  : 100;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const adminEmail = event.queryStringParameters?.adminEmail;

    const dbType = (process.env.DATABASE_TYPE || "dynamodb") as DatabaseType;
    const database = DatabaseFactory.create(dbType);

    // Get recent test runs for the specified email
    const testRuns = await database.getRecentTestRuns(
      adminEmail,
      MAX_TEST_RUNS_TO_FETCH
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        totalCount: testRuns.length,
        returnedCount: testRuns.length,
        testRuns: testRuns,
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
        error:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      }),
    };
  }
};
