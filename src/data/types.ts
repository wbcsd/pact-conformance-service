// Kysely table type definitions
import { ColumnType } from "kysely";

export interface TestRunsTable {
  testId: string;
  timestamp: ColumnType<Date, Date | string, Date | string>; // we accept Date|string on write to match original
  companyName: string;
  adminEmail: string;
  adminName: string;
  techSpecVersion: string;
  status: string | null;
  passingPercentage: number | null;
}

export interface TestResultsTable {
  testId: string;
  testKey: string;
  timestamp: ColumnType<Date, Date | string, Date | string>;
  // store whole TestResult payload as jsonb
  result: unknown; // jsonb
}

export interface TestDataTable {
  testId: string; 
  timestamp: ColumnType<Date, Date | string, Date | string>;
  data: unknown; // jsonb
}

export interface DB {
  testRuns: TestRunsTable; 
  testResults: TestResultsTable; 
  testData: TestDataTable; 
  migrations: {
    name: string;
    runAt: Date; 
  };
}
