// Mock environment variable before importing the adapter as it reads the variable during import
process.env.DYNAMODB_TABLE_NAME = "test-table";

import { handler } from "../../lambda/runTestCases";
import * as authUtils from "../../utils/authUtils";
import * as fetchFootprints from "../../utils/fetchFootprints";
import * as runTestCaseModule from "../../utils/runTestCase";
import * as dbUtils from "../../utils/dbUtils";
import { APIGatewayProxyEvent } from "aws-lambda";
import { mockFootprintsV3 } from "../mocks/footprints";
import { TestResultStatus } from "../../types/types";

// Mock the environment variables
process.env.WEBHOOK_URL = "https://webhook.test.url";

// Mock the UUID generation to get consistent test IDs
jest.mock("crypto", () => ({
  randomUUID: jest.fn().mockReturnValue("test-uuid-1234"),
}));

// Mock the dependencies
jest.mock("../../utils/authUtils");
jest.mock("../../utils/fetchFootprints");
jest.mock("../../utils/dbUtils");
jest.mock("../../utils/runTestCase");

beforeAll(() => {
  // Mock the console.log to avoid cluttering test output
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("runTestCases Lambda handler general tests", () => {
  const mockAccessToken = "mock-access-token";
  const mockOidAuthUrl = "https://auth.example.com/token";
  const mockBaseUrl = "https://api.example.com";
  const mockFootprints = {
    data: [
      {
        id: "footprint-id-1",
        productIds: ["product-id-1", "product-id-2"],
        created: "2025-01-01T00:00:00Z",
      },
    ],
  };
  const mockPaginationLinks = {
    next: "https://api.example.com/2/footprints?offset=2&limit=1",
  };

  // Prepare the APIGatewayProxyEvent mock
  const createEvent = (body: any): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      headers: {},
      multiValueHeaders: {},
      httpMethod: "POST",
      isBase64Encoded: false,
      path: "/test",
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: "",
    };
  };

  // Setup before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock the auth utils functions
    (authUtils.getOidAuthUrl as jest.Mock).mockResolvedValue(mockOidAuthUrl);
    (authUtils.getAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);

    // Mock the fetchFootprints functions
    (fetchFootprints.fetchFootprints as jest.Mock).mockResolvedValue(
      mockFootprints
    );
    (
      fetchFootprints.getLinksHeaderFromFootprints as jest.Mock
    ).mockResolvedValue(mockPaginationLinks);

    // Mock the test case runner to return success by default
    (runTestCaseModule.runTestCase as jest.Mock).mockResolvedValue({
      name: "Test Case",
      status: TestResultStatus.SUCCESS,
      success: true,
      mandatory: true,
      testKey: "TESTCASE#1",
    });

    // Mock the DB utils
    (dbUtils.saveTestRun as jest.Mock).mockResolvedValue(undefined);
    (dbUtils.saveTestData as jest.Mock).mockResolvedValue(undefined);
    (dbUtils.saveTestCaseResults as jest.Mock).mockResolvedValue(undefined);
  });

  test("should return 500 status when some tests fail", async () => {
    // Arrange
    const event = createEvent({
      baseUrl: mockBaseUrl,
      clientId: "client-id",
      clientSecret: "client-secret",
      version: "V2.2",
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
    });

    // Mock test case #4 to fail
    (runTestCaseModule.runTestCase as jest.Mock).mockImplementation(
      (baseUrl, testCase) => {
        if (testCase.testKey === "TESTCASE#4") {
          return Promise.resolve({
            name: testCase.name,
            status: TestResultStatus.FAILURE,
            success: false,
            errorMessage: "Test failed",
            mandatory: true,
            testKey: testCase.testKey,
          });
        }
        return Promise.resolve({
          name: testCase.name,
          status: TestResultStatus.SUCCESS,
          success: true,
          mandatory: true,
          testKey: testCase.testKey,
        });
      }
    );

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("One or more tests failed");

    // Calculate expected passing percentage (18/19 tests passed = ~94.7%)
    const totalMandatoryTests = 19;
    const failedMandatoryTests = 1;
    const expectedPassingPercentage = Math.round(
      ((totalMandatoryTests - failedMandatoryTests) / totalMandatoryTests) * 100
    );
    expect(body.passingPercentage).toBe(expectedPassingPercentage);
  });

  test("should handle API errors correctly", async () => {
    // Arrange
    const event = createEvent({
      baseUrl: mockBaseUrl,
      clientId: "client-id",
      clientSecret: "client-secret",
      version: "V2.3",
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
    });

    // Mock getAccessToken to throw an error
    (authUtils.getAccessToken as jest.Mock).mockRejectedValue(
      new Error("Auth failed")
    );

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Error occurred in Lambda test runner");
    expect(body.error).toBe("Auth failed");
  });

  test("should filter out optional tests for passing percentage calculation", async () => {
    // Arrange
    const event = createEvent({
      baseUrl: mockBaseUrl,
      clientId: "client-id",
      clientSecret: "client-secret",
      version: "V2.0", // Using older version where some tests are optional
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
    });

    // Mock runTestCase to make some tests mandatory and some optional
    // and have some of each fail
    (runTestCaseModule.runTestCase as jest.Mock).mockImplementation(
      (baseUrl, testCase, accessToken, version) => {
        // Tests 12, 14, 15, 16 are mandatory only for V2.2 and V2.3
        const isOptional = [
          "TESTCASE#12",
          "TESTCASE#14",
          "TESTCASE#15",
          "TESTCASE#16",
        ].includes(testCase.testKey);

        // Make test #4 fail as a mandatory test
        if (testCase.testKey === "TESTCASE#4") {
          return Promise.resolve({
            name: testCase.name,
            status: TestResultStatus.FAILURE,
            success: false,
            errorMessage: "Mandatory test failed",
            mandatory: true,
            testKey: testCase.testKey,
          });
        }

        // Make test #12 fail as an optional test
        if (testCase.testKey === "TESTCASE#12") {
          return Promise.resolve({
            name: testCase.name,
            status: TestResultStatus.FAILURE,
            success: false,
            errorMessage: "Optional test failed",
            mandatory: false,
            testKey: testCase.testKey,
          });
        }

        return Promise.resolve({
          name: testCase.name,
          status: TestResultStatus.SUCCESS,
          success: true,
          mandatory: !isOptional,
          testKey: testCase.testKey,
        });
      }
    );

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);

    // For V2.0, tests 12, 14, 15, 16 are optional
    // 1 mandatory test failed (test #4)
    // The optional test failure (#12) shouldn't affect the passing percentage
    const mandatoryTests = 20 - 4; // Total tests - optional tests
    const failedMandatoryTests = 1; // Test #4
    const expectedPassingPercentage = Math.round(
      ((mandatoryTests - failedMandatoryTests) / mandatoryTests) * 100
    );

    expect(body.passingPercentage).toBe(expectedPassingPercentage);
  });

  test("should handle missing request body fields", async () => {
    // Arrange - create an event with missing required fields
    const event = createEvent({
      // Missing required fields like baseUrl, clientId, etc.
    });

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Missing required parameters");
  });
});

describe("runTestCases Lambda handler V2 specific", () => {
  const mockAccessToken = "mock-access-token";
  const mockOidAuthUrl = "https://auth.example.com/token";
  const mockBaseUrl = "https://api.example.com";
  const mockFootprints = {
    data: [
      {
        id: "footprint-id-1",
        productIds: ["product-id-1", "product-id-2"],
        created: "2025-01-01T00:00:00Z",
      },
    ],
  };
  const mockPaginationLinks = {
    next: "https://api.example.com/2/footprints?offset=2&limit=1",
  };

  // Prepare the APIGatewayProxyEvent mock
  const createEvent = (body: any): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      headers: {},
      multiValueHeaders: {},
      httpMethod: "POST",
      isBase64Encoded: false,
      path: "/test",
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: "",
    };
  };

  // Setup before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock the auth utils functions
    (authUtils.getOidAuthUrl as jest.Mock).mockResolvedValue(mockOidAuthUrl);
    (authUtils.getAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);

    // Mock the fetchFootprints functions
    (fetchFootprints.fetchFootprints as jest.Mock).mockResolvedValue(
      mockFootprints
    );
    (
      fetchFootprints.getLinksHeaderFromFootprints as jest.Mock
    ).mockResolvedValue(mockPaginationLinks);

    // Mock the test case runner to return success by default
    (runTestCaseModule.runTestCase as jest.Mock).mockResolvedValue({
      name: "Test Case",
      status: TestResultStatus.SUCCESS,
      success: true,
      mandatory: true,
      testKey: "TESTCASE#1",
    });

    // Mock the DB utils
    (dbUtils.saveTestRun as jest.Mock).mockResolvedValue(undefined);
    (dbUtils.saveTestData as jest.Mock).mockResolvedValue(undefined);
    (dbUtils.saveTestCaseResults as jest.Mock).mockResolvedValue(undefined);
  });

  test("should execute all test cases and return success when all tests pass", async () => {
    // Arrange
    const event = createEvent({
      baseUrl: mockBaseUrl,
      clientId: "client-id",
      clientSecret: "client-secret",
      version: "V2.2",
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
    });

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("All tests passed successfully");
    expect(body.passingPercentage).toBe(100);
    expect(body.testRunId).toBe("test-uuid-1234");

    // Verify that saveTestRun was called correctly
    expect(dbUtils.saveTestRun).toHaveBeenCalledWith(
      expect.objectContaining({
        testRunId: "test-uuid-1234",
        companyName: "Test Company",
        adminEmail: "admin@test.com",
        adminName: "Admin Test",
        techSpecVersion: "V2.2",
      })
    );

    // Verify that saveTestData was called correctly
    expect(dbUtils.saveTestData).toHaveBeenCalledWith("test-uuid-1234", {
      productIds: ["product-id-1", "product-id-2"],
      version: "V2.2",
    });

    // Verify that runTestCase was called the correct number of times (once for each test case)
    // There are 18 test cases defined in the handler, plus one placeholder for TESTCASE#13 which is skipped
    expect(runTestCaseModule.runTestCase).toHaveBeenCalledTimes(19);

    // Verify that saveTestCaseResults was called with the results
    expect(dbUtils.saveTestCaseResults).toHaveBeenCalled();
    const savedResults = (dbUtils.saveTestCaseResults as jest.Mock).mock
      .calls[0][1];
    expect(savedResults).toHaveLength(21); // 18 test cases + 2 placeholders for the async test cases
  });
});

describe("runTestCases Lambda handler V3 specific", () => {
  const mockAccessToken = "mock-access-token";
  const mockOidAuthUrl = "https://auth.example.com/token";
  const mockBaseUrl = "https://api.example.com";
  const mockFootprints = mockFootprintsV3;
  const mockPaginationLinks = {
    next: "https://api.example.com/3/footprints?offset=2&limit=1",
  };

  // Prepare the APIGatewayProxyEvent mock
  const createEvent = (body: any): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      headers: {},
      multiValueHeaders: {},
      httpMethod: "POST",
      isBase64Encoded: false,
      path: "/test",
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: "",
    };
  };

  // Setup before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock the auth utils functions
    (authUtils.getOidAuthUrl as jest.Mock).mockResolvedValue(mockOidAuthUrl);
    (authUtils.getAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);

    // Mock the fetchFootprints functions
    (fetchFootprints.fetchFootprints as jest.Mock).mockResolvedValue(
      mockFootprints
    );
    (
      fetchFootprints.getLinksHeaderFromFootprints as jest.Mock
    ).mockResolvedValue(mockPaginationLinks);

    // Mock the test case runner to return success by default
    (runTestCaseModule.runTestCase as jest.Mock).mockResolvedValue({
      name: "Test Case",
      status: TestResultStatus.SUCCESS,
      success: true,
      mandatory: true,
      testKey: "TESTCASE#1",
    });

    // Mock the DB utils
    (dbUtils.saveTestRun as jest.Mock).mockResolvedValue(undefined);
    (dbUtils.saveTestData as jest.Mock).mockResolvedValue(undefined);
    (dbUtils.saveTestCaseResults as jest.Mock).mockResolvedValue(undefined);
  });

  test("should execute all test cases", async () => {
    // Arrange
    const event = createEvent({
      baseUrl: mockBaseUrl,
      clientId: "client-id",
      clientSecret: "client-secret",
      version: "V3.0",
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
    });

    // Act
    const result = await handler(event);

    // Assert
    const body = JSON.parse(result.body);

    expect(body.testRunId).toBe("test-uuid-1234");

    expect(
      body.results.find((r) => r.testKey === "TESTCASE#13")
    ).toHaveProperty("status", "PENDING");

    expect(
      body.results
        .filter(
          (r) => r.testKey !== "TESTCASE#13" && r.testKey !== "TESTCASE#14"
        )
        .every((r) => r.status === "SUCCESS")
    ).toBe(true);

    // Verify that saveTestRun was called correctly
    expect(dbUtils.saveTestRun).toHaveBeenCalledWith(
      expect.objectContaining({
        testRunId: "test-uuid-1234",
        companyName: "Test Company",
        adminEmail: "admin@test.com",
        adminName: "Admin Test",
        techSpecVersion: "V3.0",
      })
    );

    // Verify that saveTestData was called correctly
    expect(dbUtils.saveTestData).toHaveBeenCalledWith("test-uuid-1234", {
      productIds: mockFootprints.data[0].productIds,
      version: "V3.0",
    });

    // Verify that runTestCase was called the correct number of times (once for each test case)
    // There are 39 test cases defined in the handler (29 original + 10 new inverse), minus 2 async placeholders which are skipped = 37
    expect(runTestCaseModule.runTestCase).toHaveBeenCalledTimes(38);

    // Verify that saveTestCaseResults was called with the results
    expect(dbUtils.saveTestCaseResults).toHaveBeenCalled();
    const savedResults = (dbUtils.saveTestCaseResults as jest.Mock).mock
      .calls[0][1];
    expect(savedResults).toHaveLength(40); // 37 executed test cases + 2 placeholder for the async test cases
  });
});
