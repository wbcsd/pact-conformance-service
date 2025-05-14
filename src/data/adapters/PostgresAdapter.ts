import { Pool, PoolClient } from 'pg';
import { TestData, TestResult } from "../../types/types";
import { Database, TestRunDetails } from "../interfaces/Database";

export class PostgresAdapter implements Database {
  private pool: Pool;
  
  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString || process.env.POSTGRES_CONNECTION_STRING,
    });
    
    // Initialize schema if necessary
    this.initializeSchema();
  }
  
  private async initializeSchema(): Promise<void> {
    // Create tables if they don't exist
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create test_runs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_runs (
          test_id VARCHAR(255) PRIMARY KEY,
          timestamp TIMESTAMP NOT NULL,
          company_name VARCHAR(255) NOT NULL,
          company_identifier VARCHAR(255) NOT NULL,
          admin_email VARCHAR(255) NOT NULL,
          admin_name VARCHAR(255) NOT NULL,
          tech_spec_version VARCHAR(50) NOT NULL
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
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error initializing schema:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveTestRun(details: TestRunDetails): Promise<void> {
    const timestamp = new Date().toISOString();
    
    const query = `
      INSERT INTO test_runs (
        test_id, timestamp, company_name, company_identifier, 
        admin_email, admin_name, tech_spec_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (test_id) DO UPDATE SET
        timestamp = $2,
        company_name = $3,
        company_identifier = $4,
        admin_email = $5,
        admin_name = $6,
        tech_spec_version = $7
    `;
    
    const values = [
      details.testRunId,
      timestamp,
      details.companyName,
      details.companyIdentifier,
      details.adminEmail,
      details.adminName,
      details.techSpecVersion,
    ];
    
    try {
      await this.pool.query(query, values);
      console.log(`Test run ${details.testRunId} saved successfully`);
    } catch (error) {
      console.error("Error saving test run:", error);
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
          'SELECT 1 FROM test_results WHERE test_id = $1 AND test_key = $2',
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
        JSON.stringify(testResult)
      ]);
    } catch (error) {
      console.error(`Error saving test case: ${testResult.name}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveTestCaseResults(
    testRunId: string,
    testResults: TestResult[]
  ): Promise<void> {
    console.log(`Saving ${testResults.length} test cases...`);
    
    for (const testResult of testResults) {
      try {
        await this.saveTestCaseResult(testRunId, testResult, false);
      } catch (error) {
        console.error(`Failed to save test case ${testResult.name}:`, error);
        throw error;
      }
    }
    
    console.log(`All ${testResults.length} test cases saved successfully`);
  }

  async getTestResults(testRunId: string) {    
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
        SELECT timestamp FROM test_runs 
        WHERE test_id = $1
      `;
      const detailsData = await client.query(detailsQuery, [testRunId]);
      
      const results = resultsData.rows.map((row: any) => row.result);
      
      return {
        testRunId,
        timestamp: detailsData.rows.length > 0 ? detailsData.rows[0].timestamp : undefined,
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
        JSON.stringify(testData)
      ]);
      console.log("Test data saved successfully");
    } catch (error) {
      console.error("Error saving test data:", error);
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
      console.error("Error retrieving test data:", error);
      throw error;
    }
  }

  async getRecentTestRunsByEmail(adminEmail: string, limit: number = 10): Promise<any[]> {
    const query = `
      SELECT * FROM test_runs
      WHERE admin_email = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    
    try {
      const result = await this.pool.query(query, [adminEmail, limit]);
      return result.rows.map((row:any) => ({
        testId: row.test_id,
        SK: "TESTRUN#DETAILS", // For compatibility with DynamoDB format
        timestamp: row.timestamp,
        companyName: row.company_name,
        companyIdentifier: row.company_identifier,
        adminEmail: row.admin_email,
        adminName: row.admin_name,
        techSpecVersion: row.tech_spec_version
      }));
    } catch (error) {
      console.error("Error retrieving recent test runs:", error);
      throw error;
    }
  }
  
  async close(): Promise<void> {
    await this.pool.end();
  }
}