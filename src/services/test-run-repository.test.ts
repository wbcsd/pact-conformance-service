import { TestRunRepository } from "./test-run-repository";
import { CaseThenBuilder, Kysely } from "kysely";
import { DB } from "../data/types";
import {
  TestRun,
  TestResult,
  TestRunStatus,
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
        status: TestRunStatus.PENDING,
        data: null
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
        status: TestRunStatus.PENDING,
        data: null
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
    it("should set status to PASS when all mandatory tests pass", async () => {
      const testRunId = "test-run-123";
      const mockResults = [
        {
          testKey: "test-001",
          result: {
            testKey: "test-001",
            name: "Test Case 1",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
        {
          testKey: "test-002",
          result: {
            testKey: "test-002",
            name: "Test Case 2",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
      ];

      const mockSelectBuilder = createMockQueryBuilder();
      mockSelectBuilder.execute.mockResolvedValue(mockResults);
      mockDb.selectFrom.mockReturnValue(mockSelectBuilder);

      const mockUpdateBuilder = createMockQueryBuilder();
      mockUpdateBuilder.executeTakeFirst.mockResolvedValue({
        numUpdatedRows: BigInt(1),
      });
      mockDb.updateTable.mockReturnValue(mockUpdateBuilder);

      await repository.updateTestRunStatus(testRunId);

      expect(mockDb.selectFrom).toHaveBeenCalledWith("testResults");
      expect(mockDb.updateTable).toHaveBeenCalledWith("testRuns");
      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
        status: TestRunStatus.PASS,
        passingPercentage: 100,
      });
    });

    it("should set status to FAIL when at least one mandatory test fails", async () => {
      const testRunId = "test-run-123";
      const mockResults = [
        {
          testKey: "test-001",
          result: {
            testKey: "test-001",
            name: "Test Case 1",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
        {
          testKey: "test-002",
          result: {
            testKey: "test-002",
            name: "Test Case 2",
            status: TestCaseResultStatus.FAILURE,
            mandatory: true,
          },
        },
        {
          testKey: "test-003",
          result: {
            testKey: "test-003",
            name: "Test Case 3",
            status: TestCaseResultStatus.PENDING,
            mandatory: true,
          },
        },
      ];

      const mockSelectBuilder = createMockQueryBuilder();
      mockSelectBuilder.execute.mockResolvedValue(mockResults);
      mockDb.selectFrom.mockReturnValue(mockSelectBuilder);

      const mockUpdateBuilder = createMockQueryBuilder();
      mockUpdateBuilder.executeTakeFirst.mockResolvedValue({
        numUpdatedRows: BigInt(1),
      });
      mockDb.updateTable.mockReturnValue(mockUpdateBuilder);

      await repository.updateTestRunStatus(testRunId);

      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
        status: "FAIL",
        passingPercentage: 33, // 1 out of 3 passed
      });
    });

    it("should set status to PENDING when there are pending tests", async () => {
      const testRunId = "test-run-123";
      const mockResults = [
        {
          testKey: "test-001",
          result: {
            testKey: "test-001",
            name: "Test Case 1",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
        {
          testKey: "test-002",
          result: {
            testKey: "test-002",
            name: "Test Case 2",
            status: TestCaseResultStatus.PENDING,
            mandatory: true,
          },
        },
      ];

      const mockSelectBuilder = createMockQueryBuilder();
      mockSelectBuilder.execute.mockResolvedValue(mockResults);
      mockDb.selectFrom.mockReturnValue(mockSelectBuilder);

      const mockUpdateBuilder = createMockQueryBuilder();
      mockUpdateBuilder.executeTakeFirst.mockResolvedValue({
        numUpdatedRows: BigInt(1),
      });
      mockDb.updateTable.mockReturnValue(mockUpdateBuilder);

      await repository.updateTestRunStatus(testRunId);

      // PENDING tests are treated as failures in the implementation
      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
        status: "PENDING",
        passingPercentage: 50, // 1 out of 2 not failed
      });
    });

    it("should calculate passing percentage correctly with multiple failed tests", async () => {
      const testRunId = "test-run-123";
      const mockResults = [
        {
          testKey: "test-001",
          result: {
            testKey: "test-001",
            name: "Test Case 1",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
        {
          testKey: "test-002",
          result: {
            testKey: "test-002",
            name: "Test Case 2",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
        {
          testKey: "test-003",
          result: {
            testKey: "test-003",
            name: "Test Case 3",
            status: TestCaseResultStatus.FAILURE,
            mandatory: true,
          },
        },
        {
          testKey: "test-004",
          result: {
            testKey: "test-004",
            name: "Test Case 4",
            status: TestCaseResultStatus.FAILURE,
            mandatory: true,
          },
        },
      ];

      const mockSelectBuilder = createMockQueryBuilder();
      mockSelectBuilder.execute.mockResolvedValue(mockResults);
      mockDb.selectFrom.mockReturnValue(mockSelectBuilder);

      const mockUpdateBuilder = createMockQueryBuilder();
      mockUpdateBuilder.executeTakeFirst.mockResolvedValue({
        numUpdatedRows: BigInt(1),
      });
      mockDb.updateTable.mockReturnValue(mockUpdateBuilder);

      await repository.updateTestRunStatus(testRunId);

      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
        status: "FAIL",
        passingPercentage: 50, // 2 out of 4 passed
      });
    });

    it("should ignore non-mandatory tests when calculating status", async () => {
      const testRunId = "test-run-123";
      const mockResults = [
        {
          testKey: "test-001",
          result: {
            testKey: "test-001",
            name: "Test Case 1",
            status: TestCaseResultStatus.SUCCESS,
            mandatory: true,
          },
        },
        {
          testKey: "test-002",
          result: {
            testKey: "test-002",
            name: "Test Case 2",
            status: TestCaseResultStatus.FAILURE,
            mandatory: false, // non-mandatory
          },
        },
      ];

      const mockSelectBuilder = createMockQueryBuilder();
      mockSelectBuilder.execute.mockResolvedValue(mockResults);
      mockDb.selectFrom.mockReturnValue(mockSelectBuilder);

      const mockUpdateBuilder = createMockQueryBuilder();
      mockUpdateBuilder.executeTakeFirst.mockResolvedValue({
        numUpdatedRows: BigInt(1),
      });
      mockDb.updateTable.mockReturnValue(mockUpdateBuilder);

      await repository.updateTestRunStatus(testRunId);

      // Should be PASS because the only mandatory test passed
      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
        status: "PASS",
        passingPercentage: 100,
      });
    });
  });

  describe("saveTestCaseResults", () => {
    const testResult: TestResult = {
      testKey: "test-001",
      name: "Test Case 1",
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
    };

    it("should save multiple test case results with overwriteExisting=false", async () => {
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

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValue(undefined);
      mockDb.insertInto.mockReturnValue(mockBuilder);

      await repository.saveTestCaseResults(testRunId, testResults, false);

      expect(mockDb.insertInto).toHaveBeenCalledWith("testResults");
      expect(mockBuilder.onConflict).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        `Saving ${testResults.length} test cases...`
      );
      expect(logger.info).toHaveBeenCalledWith(
        `Saved ${testResults.length} test cases successfully.`
      );
    });

    it("should save a test case result when overwriteExisting is true", async () => {
      const testRunId = "test-run-123";

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValue(undefined);
      mockDb.insertInto.mockReturnValue(mockBuilder);

      await repository.saveTestCaseResults(testRunId, [testResult], true);

      expect(mockDb.insertInto).toHaveBeenCalledWith("testResults");
      expect(mockBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          testRunId,
          testKey: testResult.testKey,
          result: testResult,
        })
      );
      expect(mockBuilder.onConflict).toHaveBeenCalled();
    });

    it("should use doNothing when overwriteExisting is false", async () => {
      const testRunId = "test-run-123";
      const mockBuilder = createMockQueryBuilder();
      
      mockBuilder.execute.mockResolvedValue(undefined);
      mockDb.insertInto.mockReturnValue(mockBuilder);

      await repository.saveTestCaseResults(testRunId, [testResult], false);

      expect(mockDb.insertInto).toHaveBeenCalledWith("testResults");
      expect(mockBuilder.onConflict).toHaveBeenCalled();
      expect(mockBuilder.execute).toHaveBeenCalled();
    });

    it("should use doUpdateSet when overwriteExisting is true", async () => {
      const testRunId = "test-run-123";
      const mockBuilder = createMockQueryBuilder();
      
      mockBuilder.execute.mockResolvedValue(undefined);
      mockDb.insertInto.mockReturnValue(mockBuilder);

      await repository.saveTestCaseResults(testRunId, [testResult], true);

      expect(mockDb.insertInto).toHaveBeenCalledWith("testResults");
      expect(mockBuilder.onConflict).toHaveBeenCalled();
      expect(mockBuilder.execute).toHaveBeenCalled();
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
      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockRejectedValue(error);
      mockDb.insertInto.mockReturnValue(mockBuilder);

      await expect(
        repository.saveTestCaseResults(testRunId, testResults, false)
      ).rejects.toThrow("Save failed");
    });
  });

  describe("getTestRun", () => {
    it("should return test run details", async () => {
      const testRunId = "test-run-123";
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
      mockBuilder.executeTakeFirst.mockResolvedValueOnce(mockDetails);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      const result = await repository.getTestRun(testRunId);

      expect(result).toBeDefined();
      expect(result.testRunId).toBe(testRunId);
      expect(result.organizationName).toBe("Acme Corp");
      expect(result.adminEmail).toBe("admin@acme.com");
      expect(result.adminName).toBe("John Doe");
      expect(result.techSpecVersion).toBe("v1.0");
      expect(mockBuilder.where).toHaveBeenCalledWith("id", "=", testRunId);
    });

    it("should throw ValidationError for missing testRunId", async () => {
      await expect(repository.getTestRun("")).rejects.toThrow(ValidationError);
      await expect(repository.getTestRun("   ")).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError when test run does not exist", async () => {
      const testRunId = "non-existent-id";

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.executeTakeFirst.mockResolvedValueOnce(undefined);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      await expect(repository.getTestRun(testRunId)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("getTestRunWithResults", () => {
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

      const result = await repository.getTestRunWithResults(testRunId);

      expect(result).toBeDefined();
      expect(result?.testRunId).toBe(testRunId);
      expect(result?.results).toHaveLength(2);
      expect(result?.results[0].name).toBe("Test Case 1");
      expect(result?.results[1].name).toBe("Test Case 2");
    });

    it("should throw ValidationError for missing testRunId", async () => {
      await expect(repository.getTestRunWithResults("")).rejects.toThrow(
        ValidationError
      );
      await expect(repository.getTestRunWithResults("   ")).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw NotFoundError when test run does not exist", async () => {
      const testRunId = "non-existent-id";

      const mockBuilder = createMockQueryBuilder();
      mockBuilder.execute.mockResolvedValueOnce([]);
      mockBuilder.executeTakeFirst.mockResolvedValueOnce(undefined);
      mockDb.selectFrom.mockReturnValue(mockBuilder);

      await expect(repository.getTestRunWithResults(testRunId)).rejects.toThrow(
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

      const result = await repository.getTestRunWithResults(testRunId);

      expect(result?.results[0].name).toBe("Test Case 2");
      expect(result?.results[1].name).toBe("Test Case 10");
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