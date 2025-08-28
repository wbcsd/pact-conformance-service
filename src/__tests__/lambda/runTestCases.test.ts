import { Request, Response } from "express";
import * as authUtils from "../../utils/authUtils";
import * as fetchFootprints from "../../utils/fetchFootprints";
import * as runTestCaseModule from "../../utils/runTestCase";
import * as dbUtils from "../../utils/dbUtils";
import { TestRunController } from "../../controllers/TestRunController"; // Adjust the path as needed
import { mockFootprintsV3 } from "../mocks/footprints";
import { TestCaseResultStatus } from "../../types/types";

// Mock the environment variables
process.env.CONFORMANCE_API = "https://webhook.test.url";

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

  let controller: TestRunController;
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
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  // Setup before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock request and response
    mockRequest = {
      query: {},
      params: {},
      body: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    controller = new TestRunController();

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
      status: TestCaseResultStatus.SUCCESS,
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
    const requestBody = {
      baseUrl: mockBaseUrl,
      clientId: "client-id",
      clientSecret: "client-secret",
      version: "V2.2",
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
    };

    // Mock test case #4 to fail
    (runTestCaseModule.runTestCase as jest.Mock).mockImplementation(
      (baseUrl, testCase) => {
        if (testCase.testKey === "TESTCASE#4") {
          return Promise.resolve({
            name: testCase.name,
            status: TestCaseResultStatus.FAILURE,
            errorMessage: "Test failed",
            mandatory: true,
            testKey: testCase.testKey,
          });
        }
        return Promise.resolve({
          name: testCase.name,
          status: TestCaseResultStatus.SUCCESS,
          mandatory: true,
          testKey: testCase.testKey,
        });
      }
    );

    // Act
    mockRequest.body = requestBody;
    await controller.createTestRun(mockRequest as Request, mockResponse as Response);
    
    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      message: "One or more tests failed"
    }));

    // Calculate expected passing percentage (18/19 tests passed = ~94.7%)
    const totalMandatoryTests = 19;
    const failedMandatoryTests = 1;
    const expectedPassingPercentage = Math.round(
      ((totalMandatoryTests - failedMandatoryTests) / totalMandatoryTests) * 100
    );
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      passingPercentage: expectedPassingPercentage
    }));
  });

  test("should handle API errors correctly", async () => {
    // Arrange

    // Mock getAccessToken to throw an error
    (authUtils.getAccessToken as jest.Mock).mockRejectedValue(
      new Error("Auth failed")
    );

    // Act
    mockRequest.body = {
      baseUrl: mockBaseUrl,
      clientId: "client-id",
      clientSecret: "client-secret",
      version: "V2.3",
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
    };
    await controller.createTestRun(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "Auth failed"
    }));
  });

  test("should filter out optional tests for passing percentage calculation", async () => {
    // Arrange

    // Mock runTestCase to make some tests mandatory and some optional
    // and have some of each fail
    (runTestCaseModule.runTestCase as jest.Mock).mockImplementation(
      (baseUrl, testCase, accessToken, version) => {
        // Tests 12, 14.A, 15, 16 are mandatory only for V2.2 and V2.3
        const isOptional = [
          "TESTCASE#12",
          "TESTCASE#14.A",
          "TESTCASE#15",
          "TESTCASE#16",
        ].includes(testCase.testKey);

        // Make test #4 fail as a mandatory test
        if (testCase.testKey === "TESTCASE#4") {
          return Promise.resolve({
            name: testCase.name,
            status: TestCaseResultStatus.FAILURE,
            errorMessage: "Mandatory test failed",
            mandatory: true,
            testKey: testCase.testKey,
          });
        }

        // Make test #12 fail as an optional test
        if (testCase.testKey === "TESTCASE#12") {
          return Promise.resolve({
            name: testCase.name,
            status: TestCaseResultStatus.FAILURE,
            errorMessage: "Optional test failed",
            mandatory: false,
            testKey: testCase.testKey,
          });
        }

        return Promise.resolve({
          name: testCase.name,
          status: TestCaseResultStatus.SUCCESS,
          mandatory: !isOptional,
          testKey: testCase.testKey,
        });
      }
    );

    // Act
    mockRequest.body = {
      baseUrl: mockBaseUrl,
      clientId: "client-id",
      clientSecret: "client-secret",
      version: "V2.0", // Using older version where some tests are optional
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
    };
    await controller.createTestRun(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(500);

    // For V2.0, tests 12, 14, 15, 16 are optional
    // 1 mandatory test failed (test #4)
    // The optional test failure (#12) shouldn't affect the passing percentage
    const mandatoryTests = 20 - 4; // Total tests - optional tests
    const failedMandatoryTests = 1; // Test #4
    const expectedPassingPercentage = Math.round(
      ((mandatoryTests - failedMandatoryTests) / mandatoryTests) * 100
    );

    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      passingPercentage: expectedPassingPercentage
    }));
  });

  test("should handle missing request body fields", async () => {
    // Arrange - missing required fields

    // Act
    mockRequest.body = {
    };
    await controller.createTestRun(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      message: "Missing required parameters"
    }));
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
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let controller: TestRunController;

  // Setup before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock request and response
    mockRequest = {
      query: {},
      params: {},
      body: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    controller = new TestRunController();

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
      status: TestCaseResultStatus.SUCCESS,
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

    // Act
    mockRequest.body = {
      baseUrl: mockBaseUrl,
      clientId: "client-id",
      clientSecret: "client-secret",
            version: "V2.2",
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test"
    };
    await controller.createTestRun(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      message: "All tests passed successfully",
      passingPercentage: 100,
      testRunId: "test-uuid-1234"
    }));

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
    expect(runTestCaseModule.runTestCase).toHaveBeenCalledTimes(22);

    // Verify that saveTestCaseResults was called with the results
    expect(dbUtils.saveTestCaseResults).toHaveBeenCalled();
    const savedResults = (dbUtils.saveTestCaseResults as jest.Mock).mock
      .calls[0][1];
    expect(savedResults).toHaveLength(22); 
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

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let controller: TestRunController;

  // Setup before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock request and response
    mockRequest = {
      query: {},
      params: {},
      body: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    controller = new TestRunController();

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
      status: TestCaseResultStatus.SUCCESS,
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
    mockRequest.body = {
      baseUrl: mockBaseUrl,
      clientId: "client-id",
      clientSecret: "client-secret",
      version: "V3.0",
      companyName: "Test Company",
      adminEmail: "admin@test.com",
      adminName: "Admin Test",
    }

    // Act
    await controller.createTestRun(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(200);

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
    expect(runTestCaseModule.runTestCase).toHaveBeenCalledTimes(41);

    // Verify that saveTestCaseResults was called with the results
    expect(dbUtils.saveTestCaseResults).toHaveBeenCalled();
    const savedResults = (dbUtils.saveTestCaseResults as jest.Mock).mock
      .calls[0][1];
    
    expect(savedResults).toHaveLength(41); // 39 executed test cases + 2 placeholder for the async test cases
  });
});
