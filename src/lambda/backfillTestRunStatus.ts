import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import * as AWS from "aws-sdk";
import { calculateTestRunMetrics } from "../utils/testRunMetrics";
import { TestResult } from "../types/types";

// DynamoDB constants
const SK_TYPES = {
  DETAILS: "TESTRUN#DETAILS",
  TEST_DATA: "TESTRUN#TESTDATA",
};

interface TestRunRecord {
  testId: string;
  SK: string;
  timestamp: string;
  companyName?: string;
  adminEmail?: string;
  adminName?: string;
  techSpecVersion?: string;
  status?: string;
  passingPercentage?: number;
}

interface TestCaseRecord {
  testId: string;
  SK: string;
  timestamp: string;
  result: TestResult;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log("Starting backfill process for test run statuses");

  const docClient = new AWS.DynamoDB.DocumentClient();
  const tableName = process.env.DYNAMODB_TABLE_NAME;

  if (!tableName) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "DYNAMODB_TABLE_NAME environment variable is not set",
      }),
    };
  }

  try {
    let processedCount = 0;
    let updatedCount = 0;
    let lastEvaluatedKey;

    // First, get all test run details records
    do {
      const scanParams: AWS.DynamoDB.DocumentClient.ScanInput = {
        TableName: tableName,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: {
          ":sk": SK_TYPES.DETAILS,
        },
      };

      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const scanResult = await docClient.scan(scanParams).promise();

      if (scanResult.Items && scanResult.Items.length > 0) {
        for (const item of scanResult.Items as TestRunRecord[]) {
          processedCount++;

          // Check if status is missing or undefined
          if (!item.status) {
            console.log(`Processing test run ${item.testId} - missing status`);

            // Get all test results for this test run
            const queryParams: AWS.DynamoDB.DocumentClient.QueryInput = {
              TableName: tableName,
              KeyConditionExpression: "testId = :testId",
              ExpressionAttributeValues: {
                ":testId": item.testId,
              },
            };

            const queryResult = await docClient.query(queryParams).promise();

            if (queryResult.Items) {
              // Filter out DETAILS and TEST_DATA records to get only test case results
              const testResults: TestResult[] = queryResult.Items.filter(
                (queryItem) =>
                  queryItem.SK !== SK_TYPES.DETAILS &&
                  queryItem.SK !== SK_TYPES.TEST_DATA
              ).map((queryItem) => (queryItem as TestCaseRecord).result);

              if (testResults.length > 0) {
                // Calculate metrics using the utility function
                const { testRunStatus, passingPercentage } =
                  calculateTestRunMetrics(testResults);

                // Update the test run record with calculated status and passing percentage
                const updateParams: AWS.DynamoDB.DocumentClient.UpdateItemInput =
                  {
                    TableName: tableName,
                    Key: {
                      testId: item.testId,
                      SK: SK_TYPES.DETAILS,
                    },
                    UpdateExpression:
                      "SET #status = :status, passingPercentage = :passingPercentage",
                    ExpressionAttributeNames: {
                      "#status": "status",
                    },
                    ExpressionAttributeValues: {
                      ":status": testRunStatus,
                      ":passingPercentage": passingPercentage,
                    },
                  };

                await docClient.update(updateParams).promise();
                updatedCount++;

                console.log(
                  `Updated test run ${item.testId}: status=${testRunStatus}, passingPercentage=${passingPercentage}%`
                );
              } else {
                console.log(
                  `Test run ${item.testId} has no test results, skipping`
                );
              }
            }
          } else {
            console.log(
              `Test run ${item.testId} already has status: ${item.status}`
            );
          }
        }
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const message = `Backfill completed. Processed ${processedCount} test runs, updated ${updatedCount} records.`;
    console.log(message);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message,
        processedCount,
        updatedCount,
      }),
    };
  } catch (error) {
    console.error("Error during backfill process:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Backfill process failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
