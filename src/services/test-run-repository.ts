import { Kysely } from "kysely";
import logger from "../utils/logger";
import { DB } from "../data/types";
import {
  TestStorage,
  TestData,
  TestResult,
  TestRunWithResults,
  TestRun,
  TestCaseResultStatus,
  PagingParameters,
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

  /**
   * Calculate passing percentages for mandatory and non-mandatory tests
   */
  private calculatePassingPercentages(results: TestResult[]): {
    passingPercentage: number;
    nonMandatoryPassingPercentage: number;
  } {
    const mandatoryTests = results.filter((test) => test.mandatory);
    const failedMandatoryTests = mandatoryTests.filter(
      (test) => test.status !== TestCaseResultStatus.SUCCESS
    );

    const passingPercentage =
      mandatoryTests.length > 0
        ? Math.round(
            ((mandatoryTests.length - failedMandatoryTests.length) /
              mandatoryTests.length) *
              100
          )
        : 0;

    const nonMandatoryTests = results.filter((test) => !test.mandatory);
    const failedNonMandatoryTests = nonMandatoryTests.filter(
      (test) => test.status !== TestCaseResultStatus.SUCCESS
    );
    const nonMandatoryPassingPercentage =
      nonMandatoryTests.length > 0
        ? Math.round(
            ((nonMandatoryTests.length - failedNonMandatoryTests.length) /
              nonMandatoryTests.length) *
              100
          )
        : 0;

    return { passingPercentage, nonMandatoryPassingPercentage };
  }

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

  async updateTestRunStatus(
    testRunId: string,
    status: string,
    passingPercentage: number
  ): Promise<void> {
    try {
      const res = await this.db
        .updateTable("testRuns")
        .set({
          status,
          passingPercentage: passingPercentage,
        })
        .where("id", "=", testRunId)
        .executeTakeFirst();

      // For Postgres, res.numUpdatedRows is a BigInt-like value; coerce to number
      const updated =
        typeof res.numUpdatedRows === "bigint"
          ? Number(res.numUpdatedRows)
          : // SQLite/others may return undefined; fallback to 0/1 check
            (res as any)?.numUpdatedRows ?? 0;

      if (updated === 0) {
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

    try {
      await this.db.transaction().execute(async (tx) => {
        if (!overwriteExisting) {
          const existing = await tx
            .selectFrom("testResults")
            .select((eb) => eb.lit(1).as("one"))
            .where("testRunId", "=", testRunId)
            .where("testKey", "=", testResult.testKey)
            .executeTakeFirst();

          if (existing) {
            console.debug("Item already exists, no action taken.");
            return;
          }
        }

        await tx
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
      });
    } catch (error) {
      logger.error(`Error saving test case: ${testResult.name}`, error);
      throw error;
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
    // Validate testRunId parameter
    if (!testRunId || typeof testRunId !== 'string' || testRunId.trim() === '') {
      throw new ValidationError("Missing or invalid parameter: testRunId");
    }

    const resultsRows = await this.db
      .selectFrom("testResults")
      .select(["result"])
      .where("testRunId", "=", testRunId)
      .orderBy("testKey")
      .execute();

    const details = await this.db
      .selectFrom("testRuns")
      .selectAll()
      .where("id", "=", testRunId)
      .executeTakeFirst();

    if (!details) {
      throw new NotFoundError(`Test run not found: ${testRunId}`);
    }

    const results = resultsRows.map((r) => r.result as TestResult).sort((a, b) => {
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
      ...details as any,
      testRunId: details.id,
      results,
    };
  }

  /**
   * Get test results with calculated passing percentages for both mandatory and non-mandatory tests
   */
  async getTestResultsWithPercentages(testRunId: string): Promise<TestRunWithResults & {
    passingPercentage: number;
    nonMandatoryPassingPercentage: number;
  }> {
    const result = await this.getTestResults(testRunId);
    if (!result) {
      throw new NotFoundError(`Test run not found: ${testRunId}`);
    }

    const { passingPercentage, nonMandatoryPassingPercentage } = 
      this.calculatePassingPercentages(result.results);

    return {
      ...result,
      passingPercentage,
      nonMandatoryPassingPercentage,
    };
  }

  async saveTestData(testRunId: string, testData: TestData): Promise<void> {
    const timestamp = new Date().toISOString();

    await this.db
      .insertInto("testData")
      .values({
        testRunId: testRunId,
        timestamp,
        data: testData as unknown,
      })
      .onConflict((oc) =>
        oc.column("testRunId").doUpdateSet({
          timestamp,
          data: testData as unknown,
        })
      )
      .execute();

    logger.info("Test data saved successfully");
  }

  async getTestData(testRunId: string): Promise<TestData | null> {
    const row = await this.db
      .selectFrom("testData")
      .select(["data"])
      .where("testRunId", "=", testRunId)
      .executeTakeFirst();

    if (!row) return null;
    return row.data as TestData;
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
