import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Create test_runs if not exists
    await db.schema
      .createTable("test_runs")
      .ifNotExists()
      .addColumn("test_id", "varchar(255)", (col) => col.primaryKey())
      .addColumn("timestamp", "timestamp", (col) => col.notNull())
      .addColumn("company_name", "varchar(255)", (col) => col.notNull())
      .addColumn("admin_email", "varchar(255)", (col) => col.notNull())
      .addColumn("admin_name", "varchar(255)", (col) => col.notNull())
      .addColumn("tech_spec_version", "varchar(50)", (col) => col.notNull())
      // keep columns present for new installs; the ALTER below handles older DBs
      .addColumn("status", "varchar(50)")
      .addColumn("passing_percentage", "integer")
      .execute();

    // Create test_results if not exists
    await db.schema
      .createTable("test_results")
      .ifNotExists()
      .addColumn("test_id", "varchar(255)", (col) => col.notNull())
      .addColumn("test_key", "varchar(255)", (col) => col.notNull())
      .addColumn("timestamp", "timestamp", (col) => col.notNull())
      .addColumn("result", "jsonb", (col) => col.notNull())
      .addPrimaryKeyConstraint("test_results_pkey", ["test_id", "test_key"])
      .addForeignKeyConstraint(
        "test_results_test_runs_fkey",
        ["test_id"],
        "test_runs",
        ["test_id"]
      )
      .execute();

    // Create test_data if not exists
    await db.schema
      .createTable("test_data")
      .ifNotExists()
      .addColumn("test_id", "varchar(255)", (col) => col.primaryKey())
      .addColumn("timestamp", "timestamp", (col) => col.notNull())
      .addColumn("data", "jsonb", (col) => col.notNull())
      .addForeignKeyConstraint(
        "test_data_test_runs_fkey",
        ["test_id"],
        "test_runs",
        ["test_id"]
      )
      .execute();

    // Preserve original migration step: add status & passing_percentage if they don't exist
    await db.executeQuery(
      sql`
        ALTER TABLE test_runs 
        ADD COLUMN IF NOT EXISTS status VARCHAR(50),
        ADD COLUMN IF NOT EXISTS passing_percentage INTEGER
      `.compile(db)
    );
  }
