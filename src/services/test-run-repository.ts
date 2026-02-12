import { Kysely, sql } from "kysely";
import logger from "../utils/logger";
import { DB } from "../data/types";
import {
  TestStorage,
  TestResult,
  TestRunWithResults,
  TestRun,
  TestCaseResultStatus,
  PagingParameters,
  TestRunStatus,
} from "./types";
import { ValidationError, NotFoundError } from "../errors";

/*
 * Repository for managing test runs and their results. Test runs and
 * test results are stored in a database for retrieving historical data.
 * Implements the TestStorage interface.
 * Expected to be used with a Kysely instance.
 */
export class TestRunRepository implements TestStorage {
  
  private static readonly MAX_PAGE_SIZE = 200;
  private static readonly DEFAULT_PAGE_SIZE = 50;
  
  constructor(private db: Kysely<DB>) {}

  async saveTestRun(data: TestRun): Promise<void> {
    const timestamp = new Date().toISOString();

    try {
      await this.db
        .insertInto("testRuns")
        .values({
          id: data.testRunId,
          timestamp,
          companyName: data.organizationName,
          adminEmail: data.adminEmail,
          adminName: data.adminName,
          techSpecVersion: data.techSpecVersion,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            timestamp,
            companyName: data.organizationName,
            adminEmail: data.adminEmail,
            adminName: data.adminName,
            techSpecVersion: data.techSpecVersion,
          })
        )
        .execute();

      logger.info(`Test run ${data.testRunId} saved successfully`);
    } catch (error) {
      logger.error("Error saving test run:", error);
      throw error;
    }
  }

  async saveTestCaseResults(
    testRunId: string,
    testResults: TestResult[],
    overwriteExisting: boolean
  ): Promise<void> {
    logger.info(`Saving ${testResults.length} test cases...`);
    const timestamp = new Date().toISOString();

    for (const testResult of testResults) {
      try {
        if (!overwriteExisting) {
          await this.db
            .insertInto("testResults")
            .values({
              testRunId: testRunId,
              testKey: testResult.testKey,
              timestamp,
              // Keep behavior the same; original stored the entire result payload in JSONB.
              // Using the object directly allows pg to serialize to jsonb.
              result: testResult as unknown,
            })
            .onConflict((oc) =>
              oc.columns(["testRunId", "testKey"]).doNothing()
            )
            .execute();
        } else {
          await this.db
            .insertInto("testResults")
            .values({
              testRunId: testRunId,
              testKey: testResult.testKey,
              timestamp,
              // Keep behavior the same; original stored the entire result payload in JSONB.
              // Using the object directly allows pg to serialize to jsonb.
              result: testResult as unknown,
            })
            .onConflict((oc) =>
              oc.columns(["testRunId", "testKey"]).doUpdateSet({
                timestamp,
                result: testResult as unknown,
              })
            )
            .execute();
        }
      } catch (error) {
        logger.error(
          `Failed to save test case ${testResult.name}:`,
          error as any
        );
        throw error;
      }
    }
    logger.info(`Saved ${testResults.length} test cases successfully.`);
  }

  async updateTestRunStatus(testRunId: string): Promise<void> {
    const rows = await this.db.selectFrom("testResults")
      .select(["testKey", "result"])
      .where("testRunId", "=", testRunId)
      .execute();
    const results = rows.map((r) => r.result as TestResult);
    
    const mandatoryTests = results.filter(
      (test) => test.mandatory
    );
    const failedMandatoryTests = mandatoryTests.filter(
      (test) => test.status === TestCaseResultStatus.FAILURE
    );
    const pendingMandatoryTests = mandatoryTests.filter(
      (test) => test.status === TestCaseResultStatus.PENDING
    );
    
    let updates = null;
    if (mandatoryTests.length > 0 && failedMandatoryTests.length === 0 && pendingMandatoryTests.length === 0) {
      updates = { status: TestRunStatus.PASS, passingPercentage: 100 };
    } else if (failedMandatoryTests.length > 0) {
      updates = { status: TestRunStatus.FAIL, passingPercentage: Math.round(((mandatoryTests.length - failedMandatoryTests.length - pendingMandatoryTests.length) / mandatoryTests.length) * 100) }; 
    } else if (pendingMandatoryTests.length > 0) {
      updates = { status: TestRunStatus.PENDING, passingPercentage: Math.round(((mandatoryTests.length - pendingMandatoryTests.length) / mandatoryTests.length) * 100) };
    }

    if (updates) {
      const res = await this.db
          .updateTable("testRuns")
          .set(updates)
          .where("id", "=", testRunId)
          .executeTakeFirst();
      if (Number(res.numUpdatedRows) == 0) {
        console.warn(`No test run found with ID ${testRunId} to update`);
      }
    }
  }

  async getTestRun(testRunId: string): Promise<TestRun> {
    // Validate testRunId parameter
    if (!testRunId || typeof testRunId !== 'string' || testRunId.trim() === '') {
      throw new ValidationError("Missing or invalid parameter: testRunId");
    }

    const testRun = await this.db
      .selectFrom("testRuns")
      .selectAll()
      .where("id", "=", testRunId)
      .executeTakeFirst();

    if (!testRun) {
      throw new NotFoundError(`Test run not found: ${testRunId}`);
    }
  
    return {
      ...testRun as any,
      testRunId: testRun.id,
      organizationName: testRun.companyName,
    } as TestRun;
  }

  async getTestRunWithResults(testRunId: string): Promise<TestRunWithResults> {
    
    // Get test run details, will throw NotFoundError if not found
    const testRun = await this.getTestRun(testRunId);

    // Obtain test case results for the test run, sorted by testKey to maintain consistent order.
    const rows = await this.db
      .selectFrom("testResults")
      .select(["result"])
      .where("testRunId", "=", testRunId)
      .orderBy("testKey")
      .execute();

    const results = rows.map((r) => r.result as TestResult).sort((a, b) => {
      // Sort by extracted number from name if possible
      const extractedA = a.name.match(/\d+/);
      const extractedB = b.name.match(/\d+/);

      // Fallback to name comparison if no numbers found
      if (!extractedA || !extractedB) {
        return a.name.localeCompare(b.name);
      }

      // Compare extracted numbers as integers
      return parseInt(extractedA[0], 10) - parseInt(extractedB[0], 10);
    });

    return {
      ...testRun as any,
      results,
    } as TestRunWithResults;
  }

  async listTestRuns(
    paging: PagingParameters,
    adminEmail?: string,
  ): Promise<TestRun[]> {

    // Build query with optional filters

    let q = this.db.selectFrom("testRuns").selectAll();
    if (adminEmail) {
      q = q.where("adminEmail", "=", adminEmail);
    }
    if (paging.query) {
      const trimmedTerm = paging.query.trim();
      if (trimmedTerm) {
        q = q.where((qb) =>
          qb("companyName", "ilike", `%${trimmedTerm}%`)
            .or("adminEmail", "ilike", `%${trimmedTerm}%`)
            .or("adminName", "ilike", `%${trimmedTerm}%`)
        );
      }
    }

    const pageSize = paging.pageSize ? parseInt(paging.pageSize, 10) : TestRunRepository.DEFAULT_PAGE_SIZE;
    const pageNum = Math.max(1, Number(paging.page) || 1); // clamp to 1 for 1-based paging
    const offset = (pageNum - 1) * pageSize;

    q = q.orderBy("timestamp", "desc").limit(pageSize).offset(offset);
    logger.debug(`pagesize: ${pageSize}, pageNum: ${pageNum}, offset: ${offset}`); // Log the generated SQL query for debugging
    const rows = await q.execute();

    return rows.map(
      (row) =>
        ({
          testRunId: row.id,
          timestamp: row.timestamp as any, // preserve original shape
          organizationName: row.companyName,
          adminEmail: row.adminEmail,
          adminName: row.adminName,
          techSpecVersion: row.techSpecVersion,
          status: row.status ?? undefined,
          passingPercentage: row.passingPercentage ?? undefined,
        } as TestRun)
    );
  }

}
