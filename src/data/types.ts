// Kysely table type definitions
import { ColumnType } from "kysely";

export interface TestRunsTable {
  id: string;
  timestamp: ColumnType<Date, Date | string, Date | string>; // we accept Date|string on write to match original
  companyName: string;
  adminEmail: string;
  adminName: string;
  techSpecVersion: string;
  status: string | null;
  passingPercentage: number | null;
  data: unknown; // jsonb, nullable, flexible field to store additional data like productIds
}

export interface TestResultsTable {
  testRunId: string;
  testKey: string;
  timestamp: ColumnType<Date, Date | string, Date | string>;
  // store whole TestResult payload as jsonb
  result: unknown; // jsonb
}

export interface DB {
  testRuns: TestRunsTable; 
  testResults: TestResultsTable; 
  migrations: {
    name: string;
    runAt: Date; 
  };
}
