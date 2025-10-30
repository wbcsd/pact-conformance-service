import { CompiledQuery, Kysely, sql } from 'kysely';

/**
 * Migrates test run identifiers from a varchar-based "test_id" to UUID-based primary keys and
 * updates dependent tables to reference the new UUID keys.
 * 
 * Affected tables: test_runs, test_results, test_data.
 *
 */
export async function up(db: Kysely<any>): Promise<void> {

  const exists = await sql`SELECT 1 FROM information_schema.columns WHERE table_name='test_runs' AND column_name='id'`.execute(db);
  if (exists.rows.length > 0) {
    console.log("Column 'id' already exists in 'test_runs', skipping migration.");
    return;
  } 
  
  await sql`
    -- Add id column to test_runs and populate with UUID converted from test_id
    ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
    UPDATE test_runs SET id=cast(test_id as UUID);

    -- Add test_run_id column to test_results and populate with UUID converted from test_id
    ALTER TABLE test_results ADD COLUMN IF NOT EXISTS test_run_id UUID;
    UPDATE test_results SET test_run_id=test_id::UUID;

    -- Add test_run_id column to test_data and populate with UUID converted from test_id
    ALTER TABLE test_data ADD COLUMN IF NOT EXISTS test_run_id UUID;
    UPDATE test_data SET test_run_id=test_id::UUID;

    -- Make new columns NOT NULL
    ALTER TABLE test_runs ALTER COLUMN id SET NOT NULL;
    ALTER TABLE test_results ALTER COLUMN test_run_id SET NOT NULL;
    ALTER TABLE test_data ALTER COLUMN test_run_id SET NOT NULL;

    -- Drop foreign key constraints on old varchar columns
    ALTER TABLE test_data DROP CONSTRAINT IF EXISTS test_data_test_id_fkey;
    ALTER TABLE test_data DROP CONSTRAINT IF EXISTS test_data_test_runs_fkey;
    ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_test_id_fkey;
    ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_test_runs_fkey;

    -- Drop primary key constraints on old varchar columns
    ALTER TABLE test_data DROP CONSTRAINT IF EXISTS test_data_pkey;
    ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_pkey;
    ALTER TABLE test_runs DROP CONSTRAINT IF EXISTS test_runs_pkey;

    -- Add primary key constraints on new UUID columns
    ALTER TABLE test_runs ADD CONSTRAINT test_runs_pkey PRIMARY KEY (id);
    ALTER TABLE test_results ADD CONSTRAINT test_results_pkey PRIMARY KEY (test_run_id,test_key);
    ALTER TABLE test_data ADD CONSTRAINT test_data_pkey PRIMARY KEY (test_run_id);

    -- Construct new foreign keys
    ALTER TABLE test_data ADD CONSTRAINT test_data_test_run_id_fkey
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE;

    ALTER TABLE test_results ADD CONSTRAINT test_results_test_run_id_fkey 
    FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE;

    -- Drop old test_id columns
    ALTER TABLE test_results DROP COLUMN IF EXISTS test_id;
    ALTER TABLE test_data DROP COLUMN IF EXISTS test_id;
    ALTER TABLE test_runs DROP COLUMN IF EXISTS test_id;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Reverse the migration: convert UUID back to varchar
  
  await sql`
    -- Step 1: Add back the old varchar test_id columns
    ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS test_id VARCHAR(40);
    ALTER TABLE test_results ADD COLUMN IF NOT EXISTS test_id VARCHAR(40);
    ALTER TABLE test_data ADD COLUMN IF NOT EXISTS test_id VARCHAR(40);

    -- Step 2: Convert UUID back to varchar and populate old columns
    UPDATE test_runs SET test_id = (id::text);
    UPDATE test_results SET test_id = (test_run_id::text);
    UPDATE test_data SET test_id = (test_run_id::text);

    -- Step 3: Make old columns NOT NULL
    ALTER TABLE test_runs ALTER COLUMN test_id SET NOT NULL;
    ALTER TABLE test_results ALTER COLUMN test_id SET NOT NULL;
    ALTER TABLE test_data ALTER COLUMN test_id SET NOT NULL;

    -- Step 4: Drop primary key constraints and dependent foreign keys on new UUID columns
    ALTER TABLE test_data DROP CONSTRAINT IF EXISTS test_data_pkey CASCADE;
    ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_pkey CASCADE;
    ALTER TABLE test_runs DROP CONSTRAINT IF EXISTS test_runs_pkey CASCADE;

    -- Step 5: Restore original primary key constraints
    ALTER TABLE test_runs ADD CONSTRAINT test_runs_pkey PRIMARY KEY (test_id);
    ALTER TABLE test_results ADD CONSTRAINT test_results_pkey PRIMARY KEY (test_id, test_key);
    ALTER TABLE test_data ADD CONSTRAINT test_data_pkey PRIMARY KEY (test_id);

    -- Step 6: Restore foreign key constraints pointing to varchar test_id
    ALTER TABLE test_data ADD CONSTRAINT test_data_test_id_fkey
      FOREIGN KEY (test_id) REFERENCES test_runs(test_id) ON DELETE CASCADE;

    ALTER TABLE test_results ADD CONSTRAINT test_results_test_id_fkey 
      FOREIGN KEY (test_id) REFERENCES test_runs(test_id) ON DELETE CASCADE;

    -- Step 7: Drop the UUID columns
    ALTER TABLE test_results DROP COLUMN IF EXISTS test_run_id;
    ALTER TABLE test_data DROP COLUMN IF EXISTS test_run_id;
    ALTER TABLE test_runs DROP COLUMN IF EXISTS id;
  `.execute(db);

}
