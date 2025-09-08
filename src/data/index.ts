import { Database } from './interfaces/Database';
import { PostgresAdapter } from './adapters/PostgresAdapter';

// Create and export the database instance
export const db: Database = new PostgresAdapter();

export async function migrateToLatest(): Promise<void> {
    await db.migrateToLatest();
}
