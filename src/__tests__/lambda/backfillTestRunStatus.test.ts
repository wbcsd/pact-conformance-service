import { handler } from "../../lambda/backfillTestRunStatus";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { TestRunStatus } from "../../types/types";

// Mock AWS SDK
jest.mock("aws-sdk", () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      scan: jest.fn(),
      query: jest.fn(),
      update: jest.fn(),
    })),
  },
}));

// Mock the testRunMetrics utility
jest.mock("../../utils/testRunMetrics", () => ({
  calculateTestRunMetrics: jest.fn(),
}));

import * as AWS from "aws-sdk";
import { calculateTestRunMetrics } from "../../utils/testRunMetrics";

describe("backfillTestRunStatus Lambda", () => {
  let mockDocClient: any;
  let mockCalculateTestRunMetrics: jest.MockedFunction<
    typeof calculateTestRunMetrics
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient = {
      scan: jest.fn(),
      query: jest.fn(),
      update: jest.fn(),
    };
    (AWS.DynamoDB.DocumentClient as jest.Mock).mockReturnValue(mockDocClient);
    mockCalculateTestRunMetrics =
      calculateTestRunMetrics as jest.MockedFunction<
        typeof calculateTestRunMetrics
      >;

    process.env.DYNAMODB_TABLE_NAME = "test-table";
  });

  afterEach(() => {
    delete process.env.DYNAMODB_TABLE_NAME;
  });

  const mockEvent = {} as APIGatewayProxyEvent;
  const mockContext = {} as Context;

  it("should return error when DYNAMODB_TABLE_NAME is not set", async () => {
    delete process.env.DYNAMODB_TABLE_NAME;

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).message).toBe(
      "DYNAMODB_TABLE_NAME environment variable is not set"
    );
  });

  it("should process test runs without status and update them", async () => {
    // Mock scan to return test runs
    mockDocClient.scan.mockReturnValueOnce({
      promise: () =>
        Promise.resolve({
          Items: [
            {
              testId: "test-run-1",
              SK: "TESTRUN#DETAILS",
              timestamp: "2025-01-01T00:00:00Z",
              // Missing status property
            },
            {
              testId: "test-run-2",
              SK: "TESTRUN#DETAILS",
              timestamp: "2025-01-01T00:00:00Z",
              status: "PASS", // Already has status
            },
          ],
        }),
    });

    // Mock query to return test results for test-run-1
    mockDocClient.query.mockReturnValueOnce({
      promise: () =>
        Promise.resolve({
          Items: [
            {
              testId: "test-run-1",
              SK: "TESTRUN#DETAILS",
            },
            {
              testId: "test-run-1",
              SK: "TESTCASE#1",
              result: { name: "Test 1", success: true, mandatory: true },
            },
            {
              testId: "test-run-1",
              SK: "TESTCASE#2",
              result: { name: "Test 2", success: false, mandatory: true },
            },
          ],
        }),
    });

    // Mock calculateTestRunMetrics
    mockCalculateTestRunMetrics.mockReturnValue({
      testRunStatus: TestRunStatus.FAIL,
      passingPercentage: 50,
      failedMandatoryTests: [
        {
          name: "Test 2",
          success: false,
          mandatory: true,
          status: "FAILURE" as any,
          testKey: "TESTCASE#2",
        },
      ],
    });

    // Mock update operation
    mockDocClient.update.mockReturnValueOnce({
      promise: () => Promise.resolve({}),
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.processedCount).toBe(2);
    expect(body.updatedCount).toBe(1);

    // Verify update was called with correct parameters
    expect(mockDocClient.update).toHaveBeenCalledWith({
      TableName: "test-table",
      Key: {
        testId: "test-run-1",
        SK: "TESTRUN#DETAILS",
      },
      UpdateExpression:
        "SET #status = :status, passingPercentage = :passingPercentage",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": TestRunStatus.FAIL,
        ":passingPercentage": 50,
      },
    });
  });

  it("should handle test runs with no test results", async () => {
    mockDocClient.scan.mockReturnValueOnce({
      promise: () =>
        Promise.resolve({
          Items: [
            {
              testId: "test-run-no-results",
              SK: "TESTRUN#DETAILS",
              timestamp: "2025-01-01T00:00:00Z",
              // Missing status property
            },
          ],
        }),
    });

    // Mock query to return no test results (only details record)
    mockDocClient.query.mockReturnValueOnce({
      promise: () =>
        Promise.resolve({
          Items: [
            {
              testId: "test-run-no-results",
              SK: "TESTRUN#DETAILS",
            },
          ],
        }),
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.processedCount).toBe(1);
    expect(body.updatedCount).toBe(0);

    // Verify update was not called
    expect(mockDocClient.update).not.toHaveBeenCalled();
  });

  it("should handle DynamoDB errors gracefully", async () => {
    mockDocClient.scan.mockReturnValueOnce({
      promise: () => Promise.reject(new Error("DynamoDB error")),
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Backfill process failed");
    expect(body.error).toBe("DynamoDB error");
  });
});
