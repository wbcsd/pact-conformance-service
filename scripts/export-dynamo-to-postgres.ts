import '../src/config';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { SK_TYPES } from '../src/data/adapters/DynamoDBAdapter';
import { TestData, TestResult } from '../src/types/types';

/*
Script to export data from DynamoDB to PostgreSQL
This script scans the DynamoDB table, extracts test runs, results, and data,
and generates SQL files for importing into PostgreSQL.

Expected environment variables:
- DYNAMODB_TABLE_NAME: The name of the DynamoDB table to export from.
- AWS_REGION: The AWS region where the DynamoDB table is located (default is 'eu-north-1').

Usage:
1. Install AWS CLI and configure your credentials.
2. Set environment variables DYNAMODB_TABLE_NAME  (you can use the .env file)
3. Run the script with:
```
  npm run export:dynamo [output_directory]
```
*/

interface ExportedTestRun {
  testId: string;
  timestamp: string;
  companyName: string;
  adminEmail: string;
  adminName: string;
  techSpecVersion: string;
  status?: string;
  passingPercentage?: number;
}

interface ExportedTestResult {
  testId: string;
  testKey: string;
  timestamp: string;
  result: TestResult;
}

interface ExportedTestData {
  testId: string;
  timestamp: string;
  data: TestData;
}

export class DynamoToPostgresExporter {
  private docClient: AWS.DynamoDB.DocumentClient;
  private tableName: string;

  constructor(tableName: string) {
    this.docClient = new AWS.DynamoDB.DocumentClient({region: 'eu-north-1'});
    this.tableName = tableName;
  }

  async exportAll(outputDir: string = './exports'): Promise<void> {
    console.log('Starting DynamoDB export...');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const { testRuns, testResults, testData } = await this.scanAllData();

    console.log(`Found ${testRuns.length} test runs`);
    console.log(`Found ${testResults.length} test results`);
    console.log(`Found ${testData.length} test data records`);

    // Generate SQL files
    await this.generateTestRunsSQL(testRuns, path.join(outputDir, '01_test_runs.sql'));
    await this.generateTestResultsSQL(testResults, path.join(outputDir, '02_test_results.sql'));
    await this.generateTestDataSQL(testData, path.join(outputDir, '03_test_data.sql'));

    console.log(`Export completed! Files saved to ${outputDir}`);
  }

  private async scanAllData(): Promise<{
    testRuns: ExportedTestRun[];
    testResults: ExportedTestResult[];
    testData: ExportedTestData[];
  }> {
    const testRuns: ExportedTestRun[] = [];
    const testResults: ExportedTestResult[] = [];
    const testData: ExportedTestData[] = [];

    let lastEvaluatedKey: AWS.DynamoDB.DocumentClient.Key | undefined;
    let totalScanned = 0;

    do {
      const params: AWS.DynamoDB.DocumentClient.ScanInput = {
        TableName: this.tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await this.docClient.scan(params).promise();

      const nullToEmptyString = (value: any) => (value === null || value === undefined) ? '' : value;

      if (result.Items) {
        totalScanned += result.Items.length;
        console.log(`Scanned ${totalScanned} items...`);

        for (const item of result.Items) {
          if (item.SK === SK_TYPES.DETAILS) {
            testRuns.push({
              testId: item.testId,
              timestamp: item.timestamp,
              companyName: nullToEmptyString(item.companyName),
              adminEmail: nullToEmptyString(item.adminEmail),
              adminName: nullToEmptyString(item.adminName),
              techSpecVersion: nullToEmptyString(item.techSpecVersion),
              status: item.status,
              passingPercentage: item.passingPercentage,
            });
          } else if (item.SK === SK_TYPES.TEST_DATA) {
            testData.push({
              testId: item.testId,
              timestamp: item.timestamp,
              data: item.data,
            });
          } else {
            // Test result
            testResults.push({
              testId: item.testId,
              testKey: item.SK,
              timestamp: item.timestamp,
              result: item.result,
            });
          }
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return { testRuns, testResults, testData };
  }

  private async generateTestRunsSQL(testRuns: ExportedTestRun[], filePath: string): Promise<void> {
    const lines = [
      '-- Test Runs Data Export',
      '-- Generated on: ' + new Date().toISOString(),
      '',
      'BEGIN;',
      '',
      '-- Clear existing data (optional - remove if you want to keep existing data)',
      '-- TRUNCATE TABLE test_runs CASCADE;',
      '',
      '-- Insert test runs',
    ];

    for (const testRun of testRuns) {
      const sql = `INSERT INTO test_runs (test_id, timestamp, company_name, admin_email, admin_name, tech_spec_version, status, passing_percentage) VALUES (${this.escapeSQLValue(testRun.testId)}, ${this.escapeSQLValue(testRun.timestamp)}, ${this.escapeSQLValue(testRun.companyName)}, ${this.escapeSQLValue(testRun.adminEmail)}, ${this.escapeSQLValue(testRun.adminName)}, ${this.escapeSQLValue(testRun.techSpecVersion)}, ${this.escapeSQLValue(testRun.status)}, ${testRun.passingPercentage || 'NULL'}) ON CONFLICT (test_id) DO NOTHING;`;
      lines.push(sql);
    }

    lines.push('');
    lines.push('COMMIT;');

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Test runs SQL written to ${filePath}`);
  }

  private async generateTestResultsSQL(testResults: ExportedTestResult[], filePath: string): Promise<void> {
    const lines = [
      '-- Test Results Data Export',
      '-- Generated on: ' + new Date().toISOString(),
      '',
      'BEGIN;',
      '',
      '-- Clear existing data (optional)',
      '-- TRUNCATE TABLE test_results;',
      '',
      'ALTER TABLE test_results DROP CONSTRAINT test_results_test_id_fkey;',
      '',
      '-- Insert test results',
    ];

    for (const testResult of testResults) {
      const sql = `INSERT INTO test_results (test_id, test_key, timestamp, result) VALUES (${this.escapeSQLValue(testResult.testId)}, ${this.escapeSQLValue(testResult.testKey)}, ${this.escapeSQLValue(testResult.timestamp)}, ${this.escapeSQLValue(JSON.stringify(testResult.result))}) ON CONFLICT (test_id, test_key) DO NOTHING;`;
      lines.push(sql);
    }

    lines.push('');
    lines.push('DELETE FROM test_results WHERE test_id NOT IN (SELECT test_id FROM test_runs);');
    lines.push('');
    lines.push('ALTER TABLE test_results ADD CONSTRAINT test_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES test_runs(test_id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION;');
    lines.push('');
    lines.push('COMMIT;');

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Test results SQL written to ${filePath}`);
  }

  private async generateTestDataSQL(testData: ExportedTestData[], filePath: string): Promise<void> {
    const lines = [
      '-- Test Data Export',
      '-- Generated on: ' + new Date().toISOString(),
      '',
      'BEGIN;',
      '',
      '-- Clear existing data (optional)',
      '-- TRUNCATE TABLE test_data;',
      '',
      'ALTER TABLE test_data DROP CONSTRAINT test_data_test_id_fkey;',
      '',
      '-- Insert test data',
    ];

    for (const data of testData) {
      const sql = `INSERT INTO test_data (test_id, timestamp, data) VALUES (${this.escapeSQLValue(data.testId)}, ${this.escapeSQLValue(data.timestamp)}, ${this.escapeSQLValue(JSON.stringify(data.data))}) ON CONFLICT (test_id) DO NOTHING;`;
      lines.push(sql);
    }

    lines.push('');
    lines.push('DELETE FROM test_data WHERE test_id NOT IN (SELECT test_id FROM test_runs);');
    lines.push('');
    lines.push('ALTER TABLE test_data ADD CONSTRAINT test_data_test_id_fkey FOREIGN KEY (test_id) REFERENCES test_runs(test_id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE NO ACTION;');
    lines.push('');
    lines.push('COMMIT;');

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Test data SQL written to ${filePath}`);
  }

  private escapeSQLValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    return String(value);
  }
}

async function exportData() {
  try {
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    if (!tableName) {
      console.error('DYNAMODB_TABLE_NAME environment variable is required');
      process.exit(1);
    }

    const outputDir = process.argv[2] || './exports';
    
    console.log(`Exporting from DynamoDB table: ${tableName}`);
    console.log(`Output directory: ${outputDir}`);

    const exporter = new DynamoToPostgresExporter(tableName);
    await exporter.exportAll(outputDir);

    console.log('Export completed successfully!');
    console.log('\nTo import into PostgreSQL:');
    console.log(`1. psql -d your_database -f ${outputDir}/01_test_runs.sql`);
    console.log(`2. psql -d your_database -f ${outputDir}/02_test_results.sql`);
    console.log(`3. psql -d your_database -f ${outputDir}/03_test_data.sql`);

  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

exportData();