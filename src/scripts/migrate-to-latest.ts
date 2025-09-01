import dotenv from 'dotenv';
dotenv.config();

import logger from '../utils/logger';
import { DatabaseFactory } from '../data/factory';

async function preDeployMigration() {
  try {
    console.log('🚀 Starting pre-deployment database migration...');
    logger.info('Pre-deployment migration started');

    // Check if required environment variables are set
    const requiredEnvVars = ['DB_CONNECTION_STRING'];
    const missingEnvVars = requiredEnvVars.filter(name => !process.env[name]);
    
    if (missingEnvVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
      process.exit(1);
    }

    console.log('📊 Database connection configured');
    console.log('🔄 Running database schema migrations...');

    // Run migrations
    await DatabaseFactory.migrateToLatest();

    console.log('✅ Database schema migration completed successfully');
    logger.info('Pre-deployment migration completed successfully');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    logger.error('Pre-deployment migration failed', { error });
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('connection')) {
        console.error('💡 Check your database connection string and ensure the database is accessible');
      } else if (error.message.includes('permission')) {
        console.error('💡 Check that your database user has the necessary permissions to create/alter tables');
      }
    }
    
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️  Migration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Migration terminated');
  process.exit(1);
});

// Run the migration
preDeployMigration();