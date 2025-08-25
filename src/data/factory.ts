import { Database } from './interfaces/Database';
import { PostgresAdapter } from './adapters/PostgresAdapter';

export class DatabaseFactory {
  static create(): Database {
    return new PostgresAdapter();
  }

  static async migrateToLatest(): Promise<void> {
    const database = this.create();
    await database.migrateToLatest();
  }
}