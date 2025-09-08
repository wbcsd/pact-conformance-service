// Kysely table type definitions
import { ColumnType } from "kysely";

export interface TestRunsTable {
  test_id: string;
  timestamp: ColumnType<Date, Date | string, Date | string>; // we accept Date|string on write to match original
  company_name: string;
  admin_email: string;
  admin_name: string;
  tech_spec_version: string;
  status: string | null;
  passing_percentage: number | null;
}

export interface TestResultsTable {
  test_id: string;
  test_key: string;
  timestamp: ColumnType<Date, Date | string, Date | string>;
  // store whole TestResult payload as jsonb
  result: unknown; // jsonb
}

export interface TestDataTable {
  test_id: string;
  timestamp: ColumnType<Date, Date | string, Date | string>;
  data: unknown; // jsonb
}

export interface DB {
  test_runs: TestRunsTable;
  test_results: TestResultsTable;
  test_data: TestDataTable;
  migrations: {
    name: string;
    run_at: Date;
  };
}
