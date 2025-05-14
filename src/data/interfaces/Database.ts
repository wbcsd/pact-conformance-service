import { TestData, TestResult } from "../../types/types";

export interface TestRunDetails {
  testRunId: string;
  companyName: string;
  companyIdentifier: string;
  adminEmail: string;
  adminName: string;
  techSpecVersion: string;
}

export interface Database {
  saveTestRun(details: TestRunDetails): Promise<void>;
  saveTestCaseResult(testRunId: string, testResult: TestResult, overwriteExisting: boolean): Promise<void>;
  saveTestCaseResults(testRunId: string, testResults: TestResult[]): Promise<void>;
  getTestResults(testRunId: string): Promise<{
    testRunId: string;
    timestamp?: string;
    results: TestResult[];
  }>;
  saveTestData(testRunId: string, testData: TestData): Promise<void>;
  getTestData(testRunId: string): Promise<TestData | null>;
  getRecentTestRunsByEmail(adminEmail: string, limit?: number): Promise<any[]>;
}