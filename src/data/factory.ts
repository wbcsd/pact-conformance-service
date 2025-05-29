import { Database } from './interfaces/Database';
import { DynamoDBAdapter } from './adapters/DynamoDBAdapter';
import { PostgresAdapter } from './adapters/PostgresAdapter';

export type DatabaseType = 'dynamodb' | 'postgres';

export class DatabaseFactory {
  static create(type: DatabaseType, options?: any): Database {
    switch (type) {
      case 'dynamodb':
        return new DynamoDBAdapter(options?.tableName);
      case 'postgres':
        return new PostgresAdapter(options?.connectionString);
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }
}