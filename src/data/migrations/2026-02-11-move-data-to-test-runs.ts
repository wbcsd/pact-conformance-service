import { Kysely, sql } from 'kysely';

/**
 * Migrates the data field from test_data table to test_runs table and drops test_data table.
 * This consolidates test run data into a single table for better data organization.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Check if data column already exists in test_runs
  const dataColumnExists = await sql`
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='test_runs' AND column_name='data'
  `.execute(db);
  
  if (dataColumnExists.rows.length > 0) {
    console.log("Column 'data' already exists in 'test_runs', skipping migration.");
    return;
  }

  await sql`
    -- Add data column to test_runs table
    ALTER TABLE test_runs ADD COLUMN data JSONB;

    -- Migrate data from test_data to test_runs where records exist
    UPDATE test_runs 
    SET data = td.data 
    FROM test_data td 
    WHERE test_runs.id = td.test_run_id;

    -- Drop the test_data table (this will also drop its constraints)
    DROP TABLE IF EXISTS test_data CASCADE;
  `.execute(db);
  
  console.log("Successfully migrated data from test_data to test_runs and dropped test_data table.");
}

export async function down(db: Kysely<any>): Promise<void> {
  // Reverse the migration: recreate test_data table and move data back
  
  await sql`
    -- Recreate test_data table
    CREATE TABLE IF NOT EXISTS test_data (
      test_run_id UUID PRIMARY KEY,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      data JSONB NOT NULL
    );

    -- Add foreign key constraint
    ALTER TABLE test_data ADD CONSTRAINT test_data_test_run_id_fkey
      FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE;

    -- Migrate data back from test_runs to test_data where data is not null
    INSERT INTO test_data (test_run_id, timestamp, data)
    SELECT id, timestamp, data 
    FROM test_runs 
    WHERE data IS NOT NULL
    ON CONFLICT (test_run_id) DO UPDATE SET 
      data = EXCLUDED.data,
      timestamp = EXCLUDED.timestamp;

    -- Remove data column from test_runs
    ALTER TABLE test_runs DROP COLUMN IF EXISTS data;
  `.execute(db);
  
  console.log("Successfully rolled back migration: recreated test_data table and moved data back.");
}