import { Kysely } from "kysely";
import logger from "../utils/logger";
import { DB } from "../data/types";
import { 
  TestStorage, 
  SaveTestRunDetails, 
  TestData, 
  TestResult, 
  TestRunWithResults, 
  TestRunDetails 
} from "./types";

/*
 * Repository for managing test runs and their results. Test runs and
 * test results are stored in a database for retrieving historical data.
 * Implements the TestStorage interface.
 * Expected to be used with a Kysely instance.
 */
export class TestRunRepository implements TestStorage {

  constructor(private db: Kysely<DB>) {
  }

  async saveTestRun(details: SaveTestRunDetails): Promise<void> {
    const timestamp = new Date().toISOString();

    try {
      await this.db
        .insertInto("test_runs")
        .values({
          test_id: details.testRunId,
          timestamp,
          company_name: details.companyName,
          admin_email: details.adminEmail,
          admin_name: details.adminName,
          tech_spec_version: details.techSpecVersion,
        })
        .onConflict((oc) =>
          oc.column("test_id").doUpdateSet({
            timestamp,
            company_name: details.companyName,
            admin_email: details.adminEmail,
            admin_name: details.adminName,
            tech_spec_version: details.techSpecVersion,
          })
        )
        .execute();

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
    try {
      const res = await this.db
        .updateTable("test_runs")
        .set({
          status,
          passing_percentage: passingPercentage,
        })
        .where("test_id", "=", testRunId)
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
            .selectFrom("test_results")
            .select((eb) => eb.lit(1).as("one"))
            .where("test_id", "=", testRunId)
            .where("test_key", "=", testResult.testKey)
            .executeTakeFirst();

          if (existing) {
            console.debug("Item already exists, no action taken.");
            return;
          }
        }

        await tx
          .insertInto("test_results")
          .values({
            test_id: testRunId,
            test_key: testResult.testKey,
            timestamp,
            // Keep behavior the same; original stored the entire result payload in JSONB.
            // Using the object directly allows pg to serialize to jsonb.
            result: testResult as unknown,
          })
          .onConflict((oc) =>
            oc.columns(["test_id", "test_key"]).doUpdateSet({
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
      .selectFrom("test_results")
      .select(["result"])
      .where("test_id", "=", testRunId)
      .orderBy("test_key")
      .execute();

    const details = await this.db
      .selectFrom("test_runs")
      .selectAll()
      .where("test_id", "=", testRunId)
      .executeTakeFirst();

    const results = resultsRows.map((r) => r.result as TestResult);

    return {
      // Note: original code would throw if details is null when accessing properties.
      // We preserve that by intentionally not guarding here.
      testRunId: (details as any).test_id,
      timestamp: (details as any).timestamp,
      companyName: (details as any).company_name,
      adminEmail: (details as any).admin_email,
      adminName: (details as any).admin_name,
      techSpecVersion: (details as any).tech_spec_version,
      status: (details as any).status ?? undefined,
      passingPercentage: (details as any).passing_percentage ?? undefined,
      results,
    };
  }

  async saveTestData(testRunId: string, testData: TestData): Promise<void> {
    const timestamp = new Date().toISOString();

    try {
      await this.db
        .insertInto("test_data")
        .values({
          test_id: testRunId,
          timestamp,
          data: testData as unknown,
        })
        .onConflict((oc) =>
          oc.column("test_id").doUpdateSet({
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
        .selectFrom("test_data")
        .select(["data"])
        .where("test_id", "=", testRunId)
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
  ): Promise<TestRunDetails[]> {
    try {
      let q = this.db
        .selectFrom("test_runs")
        .selectAll();
      if (adminEmail) {
        q = q.where("admin_email", "=", adminEmail);
      }
      if (searchTerm) {
        q = q.where((qb) =>
          qb("company_name", "ilike", `%${searchTerm}%`)
          .or("admin_email", "ilike", `%${searchTerm}%`)
          .or("admin_name", "ilike", `%${searchTerm}%`))
      }
      q = q.orderBy("timestamp", "desc");
      q = q.limit(pageSize || 50);
      if (page)
        q = q.offset((page - 1) * (pageSize || 50));

      const rows = await q.execute();

      return rows.map(
        (row) =>
          ({
            testId: row.test_id,
            timestamp: row.timestamp as any, // preserve original shape
            companyName: row.company_name,
            adminEmail: row.admin_email,
            adminName: row.admin_name,
            techSpecVersion: row.tech_spec_version,
            status: row.status ?? undefined,
            passingPercentage: row.passing_percentage ?? undefined,
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
    limit?: number,
  ): Promise<TestRunDetails[]> {

  try {
      const likeTerm = `%${searchTerm.trim()}%`;
      
      let query = this.db
        .selectFrom("test_runs")
        .selectAll();

      if (adminEmail) {
        query = query.where("admin_email", "=", adminEmail)
      }

      query = query.where((eb) =>
          eb("company_name", "ilike", likeTerm)
            .or("admin_email", "ilike", likeTerm)
            .or("admin_name", "ilike", likeTerm)
          );

      query = query.orderBy("timestamp", "desc");

      if (limit) {
        query = query.limit(limit);
      }

      const rows = await query.execute();

      return rows.map(
        (row) =>
          ({
            testId: row.test_id,
            timestamp: row.timestamp.toISOString(),
            companyName: row.company_name,
            adminEmail: row.admin_email,
            adminName: row.admin_name,
            techSpecVersion: row.tech_spec_version,
            status: row.status ?? undefined,
            passingPercentage: row.passing_percentage ?? undefined,
          } as TestRunDetails)
      );
    } catch (error) {
      logger.error("Error searching test runs:", error);
      throw error;
    }
  }
}
