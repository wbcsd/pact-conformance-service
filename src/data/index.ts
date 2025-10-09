import { Kysely, sql, PostgresDialect, CamelCasePlugin } from 'kysely';
import { Pool } from "pg";
import { DB } from './types';
import config from '../config';

export const db = new Kysely<DB>({
    dialect: new PostgresDialect({
        pool: new Pool({ connectionString: config.DB_CONNECTION_STRING })
    }),
    plugins: [new CamelCasePlugin()],
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
