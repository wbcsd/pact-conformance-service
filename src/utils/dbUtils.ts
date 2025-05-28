import { TestData, TestResult } from "../types/types";
import * as AWS from "aws-sdk";

const docClient = new AWS.DynamoDB.DocumentClient();

export const SK_TYPES = {
  DETAILS: "TESTRUN#DETAILS",
  TEST_DATA: "TESTRUN#TESTDATA",
};

interface TestRunDetails {
  testRunId: string;
  companyName: string;
  adminEmail: string;
  adminName: string;
  techSpecVersion: string;
}

export const saveTestRun = async ({
  testRunId,
  companyName,
  adminEmail,
  adminName,
  techSpecVersion,
}: TestRunDetails): Promise<void> => {
  const tableName = process.env.DYNAMODB_TABLE_NAME;

  if (!tableName) {
    throw new Error("DYNAMODB_TABLE_NAME environment variable is not defined");
  }

  const timestamp = new Date().toISOString();

  const params = {
    TableName: tableName,
    Item: {
      testId: testRunId,
      SK: SK_TYPES.DETAILS,
      timestamp: timestamp,
      companyName,
      adminEmail,
      adminName,
      techSpecVersion,
    },
  };

  try {
    await docClient.put(params).promise();
    console.log(`Test run ${testRunId} saved successfully`);
  } catch (error) {
    console.error("Error saving test run:", error);
    throw error;
  }
};

export const saveTestCaseResult = async (
  testRunId: string,
  testResult: TestResult,
  overWriteExisting: boolean
): Promise<void> => {
  const tableName = process.env.DYNAMODB_TABLE_NAME;

  if (!tableName) {
    throw new Error("DYNAMODB_TABLE_NAME environment variable is not defined");
  }

  const timestamp = new Date().toISOString();

  const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
    TableName: tableName,
    Item: {
      testId: testRunId,
      SK: testResult.testKey,
      timestamp: timestamp,
      result: testResult,
    },
  };

  if (!overWriteExisting) {
    params.ConditionExpression =
      "attribute_not_exists(testId) AND attribute_not_exists(SK)";
  }

  try {
    await docClient.put(params).promise();
  } catch (error) {
    console.error(`Error saving test case: ${testResult.name}`, error);
    throw error;
  }
};

export const saveTestCaseResults = async (
  testRunId: string,
  testResults: TestResult[]
): Promise<void> => {
  console.log(`Saving ${testResults.length} test cases...`);

  const results = await Promise.allSettled(
    testResults.map((testResult) =>
      saveTestCaseResult(testRunId, testResult, false)
    )
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to save test case:", result.reason);
      if (result.reason.name === "ConditionalCheckFailedException") {
        console.debug("Item already exists, no action taken.");
      } else {
        throw result.reason;
      }
    }
  }

  console.log(`All ${testResults.length} test cases saved successfully`);
};

export const getTestResults = async (testRunId: string) => {
  const tableName = process.env.DYNAMODB_TABLE_NAME;

  if (!tableName) {
    throw new Error("DYNAMODB_TABLE_NAME environment variable is not defined");
  }

  const params = {
    TableName: tableName,
    KeyConditionExpression: "testId = :testId",
    ExpressionAttributeValues: {
      ":testId": testRunId,
    },
  };

  const result = await docClient.query(params).promise();

  if (!result.Items) {
    return {
      testRunId,
      results: [],
    };
  }

  const testResults: TestResult[] = result.Items.filter(
    (item) => item.SK !== SK_TYPES.DETAILS && item.SK !== SK_TYPES.TEST_DATA
  ).map((item) => item.result);

  const testDetails = result.Items.find((item) => item.SK === SK_TYPES.DETAILS);

  return {
    testRunId,
    timestamp: testDetails?.timestamp,
    techSpecVersion: testDetails?.techSpecVersion,
    results: testResults,
  };
};

export const saveTestData = async (
  testRunId: string,
  testData: TestData
): Promise<void> => {
  const tableName = process.env.DYNAMODB_TABLE_NAME;

  if (!tableName) {
    throw new Error("DYNAMODB_TABLE_NAME environment variable is not defined");
  }

  const timestamp = new Date().toISOString();

  const params = {
    TableName: tableName,
    Item: {
      testId: testRunId,
      SK: SK_TYPES.TEST_DATA,
      timestamp: timestamp,
      data: testData,
    },
  };

  try {
    await docClient.put(params).promise();
    console.log(`Test data saved successfully`);
  } catch (error) {
    console.error("Error saving test data:", error);
    throw error;
  }
};

export const getTestData = async (
  testRunId: string
): Promise<TestData | null> => {
  const tableName = process.env.DYNAMODB_TABLE_NAME;

  if (!tableName) {
    throw new Error("DYNAMODB_TABLE_NAME environment variable is not defined");
  }

  const params = {
    TableName: tableName,
    Key: {
      testId: testRunId,
      SK: SK_TYPES.TEST_DATA,
    },
  };

  const result = await docClient.get(params).promise();

  if (!result.Item) {
    return null;
  }

  return result.Item.data;
};
