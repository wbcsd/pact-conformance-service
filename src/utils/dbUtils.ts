import config from "../config";
import { TestData, TestResult } from "../types/types";
import { Database, SaveTestRunDetails } from "../data/interfaces/Database";
import { DatabaseFactory, DatabaseType } from "../data/factory";

// Re-exporting the SK_TYPES for backward compatibility
export { SK_TYPES } from "../data/adapters/DynamoDBAdapter";

// Create and export the database instance
const db: Database = DatabaseFactory.create(
  config.databaseType as DatabaseType
);

export const saveTestRun = async (
  details: SaveTestRunDetails
): Promise<void> => {
  return db.saveTestRun(details);
};

export const updateTestRunStatus = async (
  testRunId: string,
  status: string,
  passingPercentage: number
): Promise<void> => {
  return db.updateTestRunStatus(testRunId, status, passingPercentage);
};

export const saveTestCaseResult = async (
  testRunId: string,
  testResult: TestResult,
  overWriteExisting: boolean
): Promise<void> => {
  return db.saveTestCaseResult(testRunId, testResult, overWriteExisting);
};

export const saveTestCaseResults = async (
  testRunId: string,
  testResults: TestResult[]
): Promise<void> => {
  return db.saveTestCaseResults(testRunId, testResults);
};

export const getTestResults = async (testRunId: string) => {
  return db.getTestResults(testRunId);
};

export const saveTestData = async (
  testRunId: string,
  testData: TestData
): Promise<void> => {
  return db.saveTestData(testRunId, testData);
};

export const getTestData = async (
  testRunId: string
): Promise<TestData | null> => {
  return db.getTestData(testRunId);
};
