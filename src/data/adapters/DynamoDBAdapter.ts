import { TestData, TestResult } from "../../types/types";
import * as AWS from "aws-sdk";
import {
  Database,
  SaveTestRunDetails,
  TestRunDetails,
  TestRunWithResults,
} from "../interfaces/Database";

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

  async saveTestRun(details: SaveTestRunDetails): Promise<void> {
    const timestamp = new Date().toISOString();

    const params = {
      TableName: this.tableName,
      Item: {
        testId: details.testRunId,
        SK: SK_TYPES.DETAILS,
        timestamp,
        companyName: details.companyName,
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

  async updateTestRunStatus(
    testRunId: string,
    status: string,
    passingPercentage: number
  ): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        testId: testRunId,
        SK: SK_TYPES.DETAILS,
      },
      UpdateExpression:
        "SET #status = :status, passingPercentage = :passingPercentage",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":passingPercentage": passingPercentage,
      },
    };

    try {
      await this.docClient.update(params).promise();
      console.log(
        `Test run ${testRunId} status updated to ${status} with ${passingPercentage}% passing`
      );
    } catch (error) {
      console.error("Error updating test run status:", error);
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

    const results = await Promise.allSettled(
      testResults.map((testResult) =>
        this.saveTestCaseResult(testRunId, testResult, false)
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
  }

  async getTestResults(testRunId: string): Promise<TestRunWithResults | null> {
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

    const testResults: TestResult[] = result.Items.filter(
      (item) => item.SK !== SK_TYPES.DETAILS && item.SK !== SK_TYPES.TEST_DATA
    ).map((item) => item.result);

    const testDetails = result.Items.find(
      (item) => item.SK === SK_TYPES.DETAILS
    );

    return {
      testRunId,
      companyName: testDetails?.companyName,
      adminEmail: testDetails?.adminEmail,
      adminName: testDetails?.adminName,
      timestamp: testDetails?.timestamp,
      techSpecVersion: testDetails?.techSpecVersion,
      status: testDetails?.status,
      passingPercentage: testDetails?.passingPercentage,
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

  async getRecentTestRuns(
    adminEmail?: string,
    limit?: number
  ): Promise<TestRunDetails[]> {
    const params: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: this.tableName,
      FilterExpression: "SK = :sk",
      ExpressionAttributeValues: {
        ":sk": SK_TYPES.DETAILS,
      },
    };
    if (adminEmail) {
      params.FilterExpression += " AND adminEmail = :adminEmail";
      params.ExpressionAttributeValues![":adminEmail"] = adminEmail;
      params.IndexName = "adminEmail-timestamp-index";
      params.ScanIndexForward = false; // Sort by timestamp descending
    }
    console.log(
      `Fetching recent test runs with params: ${JSON.stringify(params)}`
    );

    let testRuns: AWS.DynamoDB.DocumentClient.ItemList = [];
    let lastEvaluatedKey;

    // Use pagination to scan DynamoDB to retrieve all items
    do {
      // Add LastEvaluatedKey to params if available from last scan
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await this.docClient.scan(params).promise();

      // Add items from this scan to our collection
      if (result.Items && result.Items.length > 0) {
        testRuns = [...testRuns, ...result.Items];
      }

      // Get the LastEvaluatedKey for next scan if available
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    // Sort by timestamp (most recent first)
    testRuns.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return testRuns.slice(0, limit || 1000).map((item: any) => ({
      testId: item.testId,
      timestamp: item.timestamp,
      companyName: item.companyName,
      adminEmail: item.adminEmail,
      adminName: item.adminName,
      techSpecVersion: item.techSpecVersion,
      status: item.status,
      passingPercentage: item.passingPercentage,
    })) as TestRunDetails[];
  }
}
