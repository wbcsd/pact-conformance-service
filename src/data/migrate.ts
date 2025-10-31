import * as path from "path";
import { promises as fs } from "fs";
import {
  Migrator,
  FileMigrationProvider,
  MigrationResultSet,
} from "kysely";
import { db } from ".";

async function migrate(command?: string, migration?: string) {
  try {

    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        // This needs to be an absolute path.
        migrationFolder: path.join(__dirname, "migrations"),
      }),
      // The table that will hold the migration state
      migrationTableName: "__migrations",
      migrationLockTableName: "__migration_lock",
    });

    let result: MigrationResultSet;
    switch (command) {
      case "help":
        console.log("usage: migrate [command] [migration]");
        console.log("commands:");
        console.log("  (no command)   Migrate to the latest version");
        console.log("  help           Show this help message");
        console.log("  list           List all migrations and their status");
        console.log("  to <name>      Migrate to a specific migration");
        console.log("  up             Run the next pending migration");
        console.log("  down           Rollback the last executed migration");
        return;
      case "list":
        const migrations = await migrator.getMigrations();
        console.table(migrations);
        return;
      case "to":
        result = await migrator.migrateTo(migration!);
        break;
      case "up":
        result = await migrator.migrateUp();
        break;
      case "down":
        result = await migrator.migrateDown();
        break;
      case "latest":
      case null:
      case undefined:
        result = await migrator.migrateToLatest();
        break;
      default:
        console.error("Unknown command: ", command);
        process.exitCode = 1;
        return;
    }
    result.results?.forEach((it) => {
      if (it.status === 'Success') {
        console.log(`migration "${it.migrationName}" was executed successfully`)
      } else if (it.status === 'Error') {
        console.error(`failed to execute migration "${it.migrationName}"`)
      } else if (it.status === 'NotExecuted') {
        console.warn(`migration "${it.migrationName}" was not executed due to earlier failures.`)
      } else {
        console.info(`migration "${it.migrationName}" has status: ${it.status as string}`)
      }
    });

    if (result.error) {
      console.error("Failed to migrate", result.error);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Unexpected error during migration", error);
    process.exitCode = 1;
  } finally {
    // Ensure the database connection is always closed.
    await db.destroy();
  }
}

migrate(process.argv[2], process.argv[3]).catch((error: unknown) => {
  console.error("Fatal error during migration process:", error);
  process.exitCode = 1;
});
