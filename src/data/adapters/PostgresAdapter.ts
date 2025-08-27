import { Pool } from "pg";
import { TestData, TestResult } from "../../types/types";
import {
  Database,
  TestRunDetails,
  TestRunWithResults,
  SaveTestRunDetails,
} from "../interfaces/Database";
import logger from "../../utils/logger";

export class PostgresAdapter implements Database {
  private pool: Pool;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString:
        connectionString || process.env.POSTGRES_CONNECTION_STRING,
    });
  }

  async migrateToLatest(): Promise<void> {
    // Create tables if they don't exist
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Create test_runs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_runs (
          test_id VARCHAR(255) PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          company_name VARCHAR(255) NOT NULL,
          admin_email VARCHAR(255) NOT NULL,
          admin_name VARCHAR(255) NOT NULL,
          tech_spec_version VARCHAR(50) NOT NULL,
          status VARCHAR(50),
          passing_percentage INTEGER
        )
      `);

      // Create test_results table
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_results (
          test_id VARCHAR(255) NOT NULL,
          test_key VARCHAR(255) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          result JSONB NOT NULL,
          PRIMARY KEY (test_id, test_key),
          FOREIGN KEY (test_id) REFERENCES test_runs(test_id)
        )
      `);

      // Create test_data table
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_data (
          test_id VARCHAR(255) PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          data JSONB NOT NULL,
          FOREIGN KEY (test_id) REFERENCES test_runs(test_id)
        )
      `);

      // Add status and passing_percentage columns if they don't exist (migration)
      await client.query(`
        ALTER TABLE test_runs 
        ADD COLUMN IF NOT EXISTS status VARCHAR(50),
        ADD COLUMN IF NOT EXISTS passing_percentage INTEGER
      `);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Error initializing schema:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveTestRun(details: SaveTestRunDetails): Promise<void> {
    const timestamp = new Date().toISOString();

    const query = `
      INSERT INTO test_runs (
        test_id, timestamp, company_name, 
        admin_email, admin_name, tech_spec_version
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (test_id) DO UPDATE SET
        timestamp = $2,
        company_name = $3,
        admin_email = $4,
        admin_name = $5,
        tech_spec_version = $6
    `;

    const values = [
      details.testRunId,
      timestamp,
      details.companyName,
      details.adminEmail,
      details.adminName,
      details.techSpecVersion,
    ];

    try {
      await this.pool.query(query, values);
      logger.info(`Test run ${details.testRunId} saved successfully`);
    } catch (error) {
      logger.error("Error saving test run:", error);
      throw error;
    }
  }

  async updateTestRunStatus(
    testRunId: string,
    status: string,
    passingPercentage: number
  ): Promise<void> {
    const query = `
      UPDATE test_runs 
      SET status = $2, passing_percentage = $3
      WHERE test_id = $1
    `;

    const values = [testRunId, status, passingPercentage];

    try {
      const result = await this.pool.query(query, values);
      if (result.rowCount === 0) {
        console.warn(`No test run found with ID ${testRunId} to update`);
      } else {
        logger.info(
          `Test run ${testRunId} status updated to ${status} with ${passingPercentage}% passing`
        );
      }
    } catch (error) {
      logger.error("Error updating test run status:", error);
      throw error;
    }
  }

  async saveTestCaseResult(
    testRunId: string,
    testResult: TestResult,
    overwriteExisting: boolean
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const client = await this.pool.connect();

    try {
      if (!overwriteExisting) {
        // Check if record already exists
        const checkResult = await client.query(
          "SELECT 1 FROM test_results WHERE test_id = $1 AND test_key = $2",
          [testRunId, testResult.testKey]
        );

        if (checkResult.rows.length > 0) {
          console.debug("Item already exists, no action taken.");
          return;
        }
      }

      const query = `
        INSERT INTO test_results (test_id, test_key, timestamp, result)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (test_id, test_key) 
        DO UPDATE SET timestamp = $3, result = $4
      `;

      await client.query(query, [
        testRunId,
        testResult.testKey,
        timestamp,
        JSON.stringify(testResult),
      ]);
    } catch (error) {
      logger.error(`Error saving test case: ${testResult.name}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveTestCaseResults(
    testRunId: string,
    testResults: TestResult[]
  ): Promise<void> {
    logger.info(`Saving ${testResults.length} test cases...`);

    for (const testResult of testResults) {
      try {
        await this.saveTestCaseResult(testRunId, testResult, false);
      } catch (error) {
        logger.error(
          `Failed to save test case ${testResult.name}:`,
          error as any
        );
        throw error;
      }
    }

    logger.info(`All ${testResults.length} test cases saved successfully`);
  }

  async getTestResults(testRunId: string): Promise<TestRunWithResults | null> {
    const client = await this.pool.connect();

    try {
      // Get test results
      const resultsQuery = `
        SELECT result FROM test_results 
        WHERE test_id = $1
      `;
      const resultsData = await client.query(resultsQuery, [testRunId]);

      // Get test run details
      const detailsQuery = `
        SELECT * FROM test_runs 
        WHERE test_id = $1
      `;
      const detailsData = await client.query(detailsQuery, [testRunId]);
      const details = detailsData.rows.length > 0 ? detailsData.rows[0] : null;

      const results = resultsData.rows.map((row: any) => row.result);

      return {
        testRunId: details.test_id,
        timestamp: details.timestamp,
        companyName: details.company_name,
        adminEmail: details.admin_email,
        adminName: details.admin_name,
        techSpecVersion: details.tech_spec_version,
        status: details.status,
        passingPercentage: details.passing_percentage,
        results,
      };
    } finally {
      client.release();
    }
  }

  async saveTestData(testRunId: string, testData: TestData): Promise<void> {
    const timestamp = new Date().toISOString();

    const query = `
      INSERT INTO test_data (test_id, timestamp, data)
      VALUES ($1, $2, $3)
      ON CONFLICT (test_id) DO UPDATE SET
        timestamp = $2,
        data = $3
    `;

    try {
      await this.pool.query(query, [
        testRunId,
        timestamp,
        JSON.stringify(testData),
      ]);
      logger.info("Test data saved successfully");
    } catch (error) {
      logger.error("Error saving test data:", error);
      throw error;
    }
  }

  async getTestData(testRunId: string): Promise<TestData | null> {
    const query = `
      SELECT data FROM test_data
      WHERE test_id = $1
    `;

    try {
      const result = await this.pool.query(query, [testRunId]);
      if (result.rows.length === 0) {
        return null;
      }
      return result.rows[0].data;
    } catch (error) {
      logger.error("Error retrieving test data:", error);
      throw error;
    }
  }

  async getRecentTestRuns(
    adminEmail?: string,
    limit?: number
  ): Promise<TestRunDetails[]> {
    const params: any[] = [];
    let query = `
      SELECT * FROM test_runs
    `;
    if (adminEmail) {
      query += ` WHERE admin_email = $1`;
      params.push(adminEmail);
    }
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit || 1000);

    try {
      const result = await this.pool.query(query, params);
      return result.rows.map(
        (row: any) =>
          ({
            testId: row.test_id,
            timestamp: row.timestamp,
            companyName: row.company_name,
            adminEmail: row.admin_email,
            adminName: row.admin_name,
            techSpecVersion: row.tech_spec_version,
            status: row.status,
            passingPercentage: row.passing_percentage,
          } as TestRunDetails)
      );
    } catch (error) {
      logger.error("Error retrieving recent test runs:", error);
      throw error;
    }
  }

  async searchTestRuns(
    searchTerm: string,
    adminEmail: string,
    limit?: number
  ): Promise<TestRunDetails[]> {
    const likeTerm = `%${searchTerm.trim()}%`;
    let query = "SELECT * FROM test_runs";
    const queryParams: any[] = [likeTerm];

    if (adminEmail) {
      query +=
        " WHERE admin_email = $2 AND (company_name ILIKE $1 OR admin_email ILIKE $1 OR admin_name ILIKE $1)";
      queryParams.push(adminEmail);
    } else {
      query +=
        " WHERE company_name ILIKE $1 OR admin_email ILIKE $1 OR admin_name ILIKE $1";
    }

    query += ` ORDER BY timestamp DESC`;

    if (limit) {
      // If adminEmail is provided, it's the 3rd parameter, otherwise 2nd
      const paramIndex = adminEmail ? 3 : 2;
      query += ` LIMIT $${paramIndex}`;
      queryParams.push(limit);
    }

    try {
      const result = await this.pool.query(query, queryParams);
      console.log("RESULTS", result.rows);
      return result.rows.map(
        (row: any) =>
          ({
            testId: row.test_id,
            timestamp: row.timestamp,
            companyName: row.company_name,
            adminEmail: row.admin_email,
            adminName: row.admin_name,
            techSpecVersion: row.tech_spec_version,
            status: row.status,
            passingPercentage: row.passing_percentage,
          } as TestRunDetails)
      );
    } catch (error) {
      logger.error("Error searching test runs:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
