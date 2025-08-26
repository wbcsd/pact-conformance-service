import { inherits } from "util";
import { TestData, TestResult, TestRunStatus } from "../../types/types";

// TODO: combine wuth TestRunDetails after fixing testId naming
export interface SaveTestRunDetails {
  testRunId: string;
  companyName: string;
  adminEmail: string;
  adminName: string;
  techSpecVersion: string;
  status: TestRunStatus;
}

// TODO: Rename testId to testRunId
export interface TestRunDetails {
  testId: string;
  companyName: string;
  adminEmail: string;
  adminName: string;
  timestamp: string;
  status: string;
  techSpecVersion: string;
  passingPercentage?: number;
}

// TODO: Rename to TestRunDetailsWithResults and extend TestRunDetails after testId naming is fixed
export interface TestRunWithResults {
  testRunId: string;
  companyName?: string;
  adminEmail?: string;
  adminName?: string;
  timestamp?: string;
  status?: string;
  techSpecVersion?: string;
  passingPercentage?: number;
  results: TestResult[];
}

export interface Database {
  migrateToLatest(): Promise<void>;
  saveTestRun(details: SaveTestRunDetails): Promise<void>;
  updateTestRunStatus(
    testRunId: string,
    status: string,
    passingPercentage: number
  ): Promise<void>;
  saveTestCaseResult(
    testRunId: string,
    testResult: TestResult,
    overwriteExisting: boolean
  ): Promise<void>;
  saveTestCaseResults(
    testRunId: string,
    testResults: TestResult[]
  ): Promise<void>;
  getTestResults(testRunId: string): Promise<TestRunWithResults | null>;
  saveTestData(testRunId: string, testData: TestData): Promise<void>;
  getTestData(testRunId: string): Promise<TestData | null>;
  getRecentTestRuns(
    adminEmail?: string,
    limit?: number
  ): Promise<TestRunDetails[]>;
}
