import { TestRunRepository } from "./test-run-repository";
import { Kysely } from "kysely";
import { DB } from "../data/types";
import {
  TestRun,
  TestResult,
  TestData,
  TestCaseResultStatus,
  PagingParameters,
} from "./types";
import { ValidationError, NotFoundError } from "../errors";
import logger from "../utils/logger";

// Mock dependencies
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe("TestRunRepository", () => {
  let repository: TestRunRepository;
  let mockDb: jest.Mocked<Kysely<DB>>;

  // Helper function to create mock query builder
  const createMockQueryBuilder = () => {
    const mockBuilder: any = {
      selectFrom: jest.fn().mockReturnThis(),
      insertInto: jest.fn().mockReturnThis(),
      updateTable: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      executeTakeFirst: jest.fn(),
      transaction: jest.fn(),
      column: jest.fn().mockReturnThis(),
      columns: jest.fn().mockReturnThis(),
      doUpdateSet: jest.fn().mockReturnThis(),
    };
    return mockBuilder;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockQueryBuilder() as any;
    repository = new TestRunRepository(mockDb);
    // Mock all console methods to prevent output during tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "debug").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "info").mockImplementation(() => {});
  });

  describe("saveTestRun", () => {
    it("should save a new test run successfully", async () => {
      const testRun: TestRun = {
        testRunId: "test-run-123",
        organizationName: "Acme Corp",
        adminEmail: "admin@acme.com",
        adminName: "John Doe",
        techSpecVersion: "v1.0",
        timestamp: "",
        status: ""
      };

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValue(undefined);
      mockDb.insertInto.mockReturnValue(mockBuilder);

      await repository.saveTestRun(testRun);

      expect(mockDb.insertInto).toHaveBeenCalledWith("testRuns");
      expect(mockBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testRun.testRunId,
          companyName: testRun.organizationName,
          adminEmail: testRun.adminEmail,
          adminName: testRun.adminName,
          techSpecVersion: testRun.techSpecVersion,
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Test run ${testRun.testRunId} saved successfully`
      );
    });

    it("should handle errors when saving test run", async () => {
      const testRun: TestRun = {
        testRunId: "test-run-123",
        organizationName: "Acme Corp",
        adminEmail: "admin@acme.com",
        adminName: "John Doe",
        techSpecVersion: "v1.0",
        timestamp: "",
        status: ""
      };

      const error = new Error("Database error");
      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockRejectedValue(error);
      mockDb.insertInto.mockReturnValue(mockBuilder);

      await expect(repository.saveTestRun(testRun)).rejects.toThrow(
        "Database error"
      );
      expect(logger.error).toHaveBeenCalledWith("Error saving test run:", error);
    });
  });

  describe("updateTestRunStatus", () => {
    it("should update test run status successfully", async () => {
      const testRunId = "test-run-123";
      const status = "completed";
      const passingPercentage = 85;

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.executeTakeFirst.mockResolvedValue({
        numUpdatedRows: BigInt(1),
      });
      mockDb.updateTable.mockReturnValue(mockBuilder);

      await repository.updateTestRunStatus(
        testRunId,
        status,
        passingPercentage
      );

      expect(mockDb.updateTable).toHaveBeenCalledWith("testRuns");
      expect(mockBuilder.set).toHaveBeenCalledWith({
        status,
        passingPercentage,
      });
      expect(mockBuilder.where).toHaveBeenCalledWith("id", "=", testRunId);
      expect(logger.info).toHaveBeenCalledWith(
        `Test run ${testRunId} status updated to ${status} with ${passingPercentage}% passing`
      );
    });

    it("should warn when no test run is found to update", async () => {
      const testRunId = "non-existent-id";
      const status = "completed";
      const passingPercentage = 85;

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.executeTakeFirst.mockResolvedValue({
        numUpdatedRows: BigInt(0),
      });
      mockDb.updateTable.mockReturnValue(mockBuilder);

      await repository.updateTestRunStatus(
        testRunId,
        status,
        passingPercentage
      );

      expect(console.warn).toHaveBeenCalledWith(
        `No test run found with ID ${testRunId} to update`
      );
    });

    it("should handle errors when updating test run status", async () => {
      const error = new Error("Update failed");
      const mockBuilder = createMockQueryBuilder();
      mockBuilder.executeTakeFirst.mockRejectedValue(error);
      mockDb.updateTable.mockReturnValue(mockBuilder);

      await expect(
        repository.updateTestRunStatus("test-run-123", "completed", 85)
      ).rejects.toThrow("Update failed");
      expect(logger.error).toHaveBeenCalledWith(
        "Error updating test run status:",
        error
      );
    });
  });

  describe("saveTestCaseResult", () => {
    const testResult: TestResult = {
      testKey: "test-001",
      name: "Test Case 1",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
    };

    it("should save a new test case result when overwriteExisting is true", async () => {
      const testRunId = "test-run-123";

      const mockTx = createMockQueryBuilder();
      mockTx.execute.mockResolvedValue(undefined);
      
      const mockTransaction = {
        execute: jest.fn().mockImplementation(async (fn) => {
          return await fn(mockTx);
        }),
      };

      mockDb.transaction.mockReturnValue(mockTransaction as any);
      mockTx.insertInto.mockReturnValue(mockTx);

      await repository.saveTestCaseResult(testRunId, testResult, true);

      expect(mockTx.insertInto).toHaveBeenCalledWith("testResults");
      expect(mockTx.values).toHaveBeenCalledWith(
        expect.objectContaining({
          testRunId,
          testKey: testResult.testKey,
          result: testResult,
        })
      );
    });

    it("should not save when result exists and overwriteExisting is false", async () => {
      const testRunId = "test-run-123";

      const mockTx = createMockQueryBuilder();
      mockTx.executeTakeFirst.mockResolvedValue({ one: 1 });
      
      const mockTransaction = {
        execute: jest.fn().mockImplementation(async (fn) => {
          return await fn(mockTx);
        }),
      };

      mockDb.transaction.mockReturnValue(mockTransaction as any);
      mockTx.selectFrom.mockReturnValue(mockTx);

      await repository.saveTestCaseResult(testRunId, testResult, false);

      expect(console.debug).toHaveBeenCalledWith(
        "Item already exists, no action taken."
      );
      expect(mockTx.insertInto).not.toHaveBeenCalled();
    });

    it("should handle errors when saving test case result", async () => {
      const error = new Error("Save failed");
      const mockTransaction = {
        execute: jest.fn().mockRejectedValue(error),
      };

      mockDb.transaction.mockReturnValue(mockTransaction as any);

      await expect(
        repository.saveTestCaseResult("test-run-123", testResult, true)
      ).rejects.toThrow("Save failed");
      expect(logger.error).toHaveBeenCalledWith(
        `Error saving test case: ${testResult.name}`,
        error
      );
    });
  });

  describe("saveTestCaseResults", () => {
    it("should save multiple test case results", async () => {
      const testRunId = "test-run-123";
      const testResults: TestResult[] = [
        {
          testKey: "test-001",
          name: "Test Case 1",
          status: TestCaseResultStatus.SUCCESS,
          mandatory: true,
        },
        {
          testKey: "test-002",
          name: "Test Case 2",
          status: TestCaseResultStatus.FAILURE,
          mandatory: false,
        },
      ];

      const mockTx = createMockQueryBuilder();
      mockTx.executeTakeFirst.mockResolvedValue(null);
      mockTx.execute.mockResolvedValue(undefined);
      
      const mockTransaction = {
        execute: jest.fn().mockImplementation(async (fn) => {
          return await fn(mockTx);
        }),
      };

      mockDb.transaction.mockReturnValue(mockTransaction as any);
      mockTx.selectFrom.mockReturnValue(mockTx);
      mockTx.insertInto.mockReturnValue(mockTx);

      await repository.saveTestCaseResults(testRunId, testResults);

      expect(logger.info).toHaveBeenCalledWith(
        `Saving ${testResults.length} test cases...`
      );
      expect(logger.info).toHaveBeenCalledWith(
        `All ${testResults.length} test cases saved successfully`
      );
    });

    it("should handle errors when saving test case results", async () => {
      const testRunId = "test-run-123";
      const testResults: TestResult[] = [
        {
          testKey: "test-001",
          name: "Test Case 1",
          status: TestCaseResultStatus.SUCCESS,
          mandatory: true,
        },
      ];

      const error = new Error("Save failed");
      const mockTransaction = {
        execute: jest.fn().mockRejectedValue(error),
      };

      mockDb.transaction.mockReturnValue(mockTransaction as any);

      await expect(
        repository.saveTestCaseResults(testRunId, testResults)
      ).rejects.toThrow("Save failed");
    });
  });

  describe("getTestResults", () => {
    it("should return test run with results", async () => {
      const testRunId = "test-run-123";
      const mockResults = [
        {
          result: {
            testKey: "test-002",
            name: "Test Case 2",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
        {
          result: {
            testKey: "test-001",
            name: "Test Case 1",
            status: TestCaseResultStatus.FAILURE,
            mandatory: false,
          },
        },
      ];

      const mockDetails = {
        id: testRunId,
        timestamp: "2024-01-01T00:00:00Z",
        companyName: "Acme Corp",
        adminEmail: "admin@acme.com",
        adminName: "John Doe",
        techSpecVersion: "v1.0",
        status: "completed",
        passingPercentage: 85,
      };

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValueOnce(mockResults);
      mockBuilder.executeTakeFirst.mockResolvedValueOnce(mockDetails);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const result = await repository.getTestResults(testRunId);

      expect(result).toBeDefined();
      expect(result?.testRunId).toBe(testRunId);
      expect(result?.results).toHaveLength(2);
      expect(result?.results[0].name).toBe("Test Case 1");
      expect(result?.results[1].name).toBe("Test Case 2");
    });

    it("should throw ValidationError for missing testRunId", async () => {
      await expect(repository.getTestResults("")).rejects.toThrow(
        ValidationError
      );
      await expect(repository.getTestResults("   ")).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw NotFoundError when test run does not exist", async () => {
      const testRunId = "non-existent-id";

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValueOnce([]);
      mockBuilder.executeTakeFirst.mockResolvedValueOnce(undefined);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      await expect(repository.getTestResults(testRunId)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should sort results by numeric value in name", async () => {
      const testRunId = "test-run-123";
      const mockResults = [
        {
          result: {
            testKey: "test-010",
            name: "Test Case 10",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
        {
          result: {
            testKey: "test-002",
            name: "Test Case 2",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
      ];

      const mockDetails = {
        id: testRunId,
        timestamp: "2024-01-01T00:00:00Z",
        companyName: "Acme Corp",
        adminEmail: "admin@acme.com",
        adminName: "John Doe",
        techSpecVersion: "v1.0",
      };

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValueOnce(mockResults);
      mockBuilder.executeTakeFirst.mockResolvedValueOnce(mockDetails);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const result = await repository.getTestResults(testRunId);

      expect(result?.results[0].name).toBe("Test Case 2");
      expect(result?.results[1].name).toBe("Test Case 10");
    });
  });

  describe("getTestResultsWithPercentages", () => {
    it("should return test results with calculated passing percentages", async () => {
      const testRunId = "test-run-123";
      const mockResults = [
        {
          result: {
            testKey: "test-001",
            name: "Test Case 1",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
        {
          result: {
            testKey: "test-002",
            name: "Test Case 2",
            status: TestCaseResultStatus.FAILURE,
            mandatory: true,
          },
        },
        {
          result: {
            testKey: "test-003",
            name: "Test Case 3",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: false,
          },
        },
      ];

      const mockDetails = {
        id: testRunId,
        timestamp: "2024-01-01T00:00:00Z",
        companyName: "Acme Corp",
        adminEmail: "admin@acme.com",
        adminName: "John Doe",
        techSpecVersion: "v1.0",
      };

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValueOnce(mockResults);
      mockBuilder.executeTakeFirst.mockResolvedValueOnce(mockDetails);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const result = await repository.getTestResultsWithPercentages(testRunId);

      expect(result.passingPercentage).toBe(50); // 1 out of 2 mandatory tests passed
      expect(result.nonMandatoryPassingPercentage).toBe(100); // 1 out of 1 non-mandatory test passed
    });

    it("should handle zero tests correctly", async () => {
      const testRunId = "test-run-123";
      const mockDetails = {
        id: testRunId,
        timestamp: "2024-01-01T00:00:00Z",
        companyName: "Acme Corp",
        adminEmail: "admin@acme.com",
        adminName: "John Doe",
        techSpecVersion: "v1.0",
      };

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValueOnce([]);
      mockBuilder.executeTakeFirst.mockResolvedValueOnce(mockDetails);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const result = await repository.getTestResultsWithPercentages(testRunId);

      expect(result.passingPercentage).toBe(0);
      expect(result.nonMandatoryPassingPercentage).toBe(0);
    });
  });

  describe("saveTestData", () => {
    it("should save test data successfully", async () => {
      const testRunId = "test-run-123";
      const testData: TestData = {
        productIds: ["product1", "product2"],
        version: "V2.2",
      };

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValue(undefined);
      mockDb.insertInto.mockReturnValue(mockBuilder);

      await repository.saveTestData(testRunId, testData);

      expect(mockDb.insertInto).toHaveBeenCalledWith("testData");
      expect(mockBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          testRunId,
          data: testData,
        })
      );
      expect(logger.info).toHaveBeenCalledWith("Test data saved successfully");
    });
  });

  describe("getTestData", () => {
    it("should return test data when it exists", async () => {
      const testRunId = "test-run-123";
      const testData: TestData = {
        productIds: ["product1", "product2"],
        version: "V2.2",
      };

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.executeTakeFirst.mockResolvedValue({ data: testData });
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const result = await repository.getTestData(testRunId);

      expect(result).toEqual(testData);
    });

    it("should return null when test data does not exist", async () => {
      const testRunId = "non-existent-id";

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.executeTakeFirst.mockResolvedValue(undefined);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const result = await repository.getTestData(testRunId);

      expect(result).toBeNull();
    });
  });

  describe("listTestRuns", () => {
    it("should list test runs with default paging", async () => {
      const mockRows = [
        {
          id: "test-run-1",
          timestamp: "2024-01-01T00:00:00Z",
          companyName: "Acme Corp",
          adminEmail: "admin@acme.com",
          adminName: "John Doe",
          techSpecVersion: "v1.0",
          status: "completed",
          passingPercentage: 85,
        },
      ];

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValue(mockRows);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const paging: PagingParameters = {};
      const result = await repository.listTestRuns(paging);

      expect(result).toHaveLength(1);
      expect(result[0].testRunId).toBe("test-run-1");
      expect(mockBuilder.limit).toHaveBeenCalledWith(50);
      expect(mockBuilder.offset).toHaveBeenCalledWith(0);
    });

    it("should filter by adminEmail", async () => {
      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValue([]);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const paging: PagingParameters = {};
      await repository.listTestRuns(paging, "admin@acme.com");

      expect(mockBuilder.where).toHaveBeenCalledWith(
        "adminEmail",
        "=",
        "admin@acme.com"
      );
    });

    it("should filter by search query", async () => {
      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValue([]);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const paging: PagingParameters = {
        query: "Acme",
      };
      await repository.listTestRuns(paging);

      expect(mockBuilder.where).toHaveBeenCalled();
    });

    it("should handle custom page size and page number", async () => {
      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValue([]);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const paging: PagingParameters = {
        pageSize: "10",
        page: "3",
      };
      await repository.listTestRuns(paging);

      expect(mockBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockBuilder.offset).toHaveBeenCalledWith(20); // (3-1) * 10
    });

    it("should handle invalid page number by defaulting to 1", async () => {
      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValue([]);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const paging: PagingParameters = {
        page: "0",
      };
      await repository.listTestRuns(paging);

      expect(mockBuilder.offset).toHaveBeenCalledWith(0);
    });
  });
});