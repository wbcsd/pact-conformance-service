import { Kysely, sql, PostgresDialect } from 'kysely';
import pg from 'pg';
import config from '../config';
import { DB } from './types';

const { Pool } = pg;

export const db = new Kysely<DB>({
    dialect: new PostgresDialect({
        pool: new Pool({ connectionString: config.DB_CONNECTION_STRING })
    })
});

export async function checkConnection(): Promise<boolean> {
    try {
        // Use Kysely's sql template with a simple query that works across databases
        await sql`SELECT 1`.execute(db);
        return true;
    } catch (error) {
        console.error("Database connection error:", error);
        return false;
    }
}

export async function shutdownDB() {
    await db.destroy();
}
