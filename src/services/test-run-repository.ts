import { Kysely } from "kysely";
import logger from "../utils/logger";
import { DB } from "../data/types";
import {
  TestStorage,
  TestData,
  TestResult,
  TestRunWithResults,
  TestRun,
} from "./types";

/*
 * Repository for managing test runs and their results. Test runs and
 * test results are stored in a database for retrieving historical data.
 * Implements the TestStorage interface.
 * Expected to be used with a Kysely instance.
 */
export class TestRunRepository implements TestStorage {
  
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
    // Keep the same “two round trips” approach and the same null handling semantics
    // as the original (which would throw if details are missing but results exist).
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

    const results = resultsRows.map((r) => r.result as TestResult);

    return {
      ...details as any,
      testRunId: details?.id ?? "",
      results,
    }
  }

  async saveTestData(testRunId: string, testData: TestData): Promise<void> {
    const timestamp = new Date().toISOString();

    try {
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
    } catch (error) {
      logger.error("Error saving test data:", error);
      throw error;
    }
  }

  async getTestData(testRunId: string): Promise<TestData | null> {
    try {
      const row = await this.db
        .selectFrom("testData")
        .select(["data"])
        .where("testRunId", "=", testRunId)
        .executeTakeFirst();

      if (!row) return null;
      return row.data as TestData;
    } catch (error) {
      logger.error("Error retrieving test data:", error);
      throw error;
    }
  }

  async listTestRuns(
    adminEmail?: string,
    searchTerm?: string,
    page?: number,
    pageSize?: number
  ): Promise<TestRun[]> {
    try {
      let q = this.db.selectFrom("testRuns").selectAll();
      if (adminEmail) {
        q = q.where("adminEmail", "=", adminEmail);
      }
      if (searchTerm) {
        q = q.where((qb) =>
          qb("companyName", "ilike", `%${searchTerm}%`)
            .or("adminEmail", "ilike", `%${searchTerm}%`)
            .or("adminName", "ilike", `%${searchTerm}%`)
        );
      }

      const size = Number.isFinite(Number(pageSize)) ? Number(pageSize) : 50;
      const pageNum = Math.max(1, Number(page) || 1); // clamp to 1 for 1-based paging
      const offset = (pageNum - 1) * size;

      q = q.orderBy("timestamp", "desc").limit(size).offset(offset);

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
    } catch (error) {
      logger.error("Error retrieving recent test runs:", error);
      throw error;
    }
  }

  async searchTestRuns(
    searchTerm: string,
    adminEmail: string,
    limit?: number
  ): Promise<TestRun[]> {
    try {
      const likeTerm = `%${searchTerm.trim()}%`;

      let query = this.db.selectFrom("testRuns").selectAll();

      if (adminEmail) {
        query = query.where("adminEmail", "=", adminEmail);
      }

      query = query.where((eb) =>
        eb("companyName", "ilike", likeTerm)
          .or("adminEmail", "ilike", likeTerm)
          .or("adminName", "ilike", likeTerm)
      );

      query = query.orderBy("timestamp", "desc");

      if (limit) {
        query = query.limit(limit);
      }

      const rows = await query.execute();

      return rows.map(
        (row) =>
          ({
            testRunId: row.id,
            timestamp: row.timestamp.toISOString(),
            organizationName: row.companyName,
            adminEmail: row.adminEmail,
            adminName: row.adminName,
            techSpecVersion: row.techSpecVersion,
            status: row.status ?? undefined,
            passingPercentage: row.passingPercentage ?? undefined,
          } as TestRun)
      );
    } catch (error) {
      logger.error("Error searching test runs:", error);
      throw error;
    }
  }
}
