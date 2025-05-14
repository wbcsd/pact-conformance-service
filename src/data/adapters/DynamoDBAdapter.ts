import { TestData, TestResult } from "../../types/types";
import * as AWS from "aws-sdk";
import { Database, TestRunDetails } from "../interfaces/Database";

export const SK_TYPES = {
  DETAILS: "TESTRUN#DETAILS",
  TEST_DATA: "TESTRUN#TESTDATA",
};

export class DynamoDBAdapter implements Database {
  private docClient: AWS.DynamoDB.DocumentClient;
  private tableName: string;

  constructor(tableName?: string) {
    this.docClient = new AWS.DynamoDB.DocumentClient();
    this.tableName = tableName || process.env.DYNAMODB_TABLE_NAME || "";
    
    if (!this.tableName) {
      throw new Error("DynamoDB table name is not defined");
    }
  }

  async saveTestRun(details: TestRunDetails): Promise<void> {
    const timestamp = new Date().toISOString();

    const params = {
      TableName: this.tableName,
      Item: {
        testId: details.testRunId,
        SK: SK_TYPES.DETAILS,
        timestamp,
        companyName: details.companyName,
        companyIdentifier: details.companyIdentifier,
        adminEmail: details.adminEmail,
        adminName: details.adminName,
        techSpecVersion: details.techSpecVersion,
      },
    };

    try {
      await this.docClient.put(params).promise();
      console.log(`Test run ${details.testRunId} saved successfully`);
    } catch (error) {
      console.error("Error saving test run:", error);
      throw error;
    }
  }

  async saveTestCaseResult(
    testRunId: string,
    testResult: TestResult,
    overwriteExisting: boolean
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: this.tableName,
      Item: {
        testId: testRunId,
        SK: testResult.testKey,
        timestamp,
        result: testResult,
      },
    };

    if (!overwriteExisting) {
      params.ConditionExpression =
        "attribute_not_exists(testId) AND attribute_not_exists(SK)";
    }

    try {
      await this.docClient.put(params).promise();
    } catch (error) {
      console.error(`Error saving test case: ${testResult.name}`, error);
      throw error;
    }
  }

  async saveTestCaseResults(
    testRunId: string,
    testResults: TestResult[]
  ): Promise<void> {
    console.log(`Saving ${testResults.length} test cases...`);

    for (const testResult of testResults) {
      try {
        await this.saveTestCaseResult(testRunId, testResult, false);
      } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
          console.debug("Item already exists, no action taken.");
        } else {
          throw error;
        }
      }
    }

    console.log(`All ${testResults.length} test cases saved successfully`);
  }

  async getTestResults(testRunId: string) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: "testId = :testId",
      ExpressionAttributeValues: {
        ":testId": testRunId,
      },
    };

    const result = await this.docClient.query(params).promise();

    if (!result.Items) {
      return {
        testRunId,
        results: [],
      };
    }

    const testResults: TestResult[] = result.Items
      .filter((item) => item.SK !== SK_TYPES.DETAILS && item.SK !== SK_TYPES.TEST_DATA)
      .map((item) => item.result);

    const testDetails = result.Items.find((item) => item.SK === SK_TYPES.DETAILS);

    return {
      testRunId,
      timestamp: testDetails?.timestamp,
      results: testResults,
    };
  }

  async saveTestData(testRunId: string, testData: TestData): Promise<void> {
    const timestamp = new Date().toISOString();

    const params = {
      TableName: this.tableName,
      Item: {
        testId: testRunId,
        SK: SK_TYPES.TEST_DATA,
        timestamp,
        data: testData,
      },
    };

    try {
      await this.docClient.put(params).promise();
      console.log("Test data saved successfully");
    } catch (error) {
      console.error("Error saving test data:", error);
      throw error;
    }
  }

  async getTestData(testRunId: string): Promise<TestData | null> {
    const params = {
      TableName: this.tableName,
      Key: {
        testId: testRunId,
        SK: SK_TYPES.TEST_DATA,
      },
    };

    const result = await this.docClient.get(params).promise();

    if (!result.Item) {
      return null;
    }

    return result.Item.data;
  }

  async getRecentTestRunsByEmail(adminEmail: string, limit: number = 10): Promise<any[]> {
    const params: AWS.DynamoDB.DocumentClient.ScanInput = {
      TableName: this.tableName,
      FilterExpression: "adminEmail = :adminEmail AND SK = :sk",
      ExpressionAttributeValues: {
        ":adminEmail": adminEmail,
        ":sk": SK_TYPES.DETAILS,
      },
    };

    let testRuns: AWS.DynamoDB.DocumentClient.ItemList = [];
    let lastEvaluatedKey;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await this.docClient.scan(params).promise();

      if (result.Items && result.Items.length > 0) {
        testRuns = [...testRuns, ...result.Items];
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    testRuns.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return testRuns.slice(0, limit);
  }
}