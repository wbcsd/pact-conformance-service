import { Database } from './interfaces/Database';
import { PostgresAdapter } from './adapters/PostgresAdapter';

export class DatabaseFactory {
  static create(): Database {
    return new PostgresAdapter();
  }
}