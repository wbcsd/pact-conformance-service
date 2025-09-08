import dotenv from 'dotenv';
dotenv.config();
import logger from '../utils/logger';
import { db, checkConnection } from '../data';

(async () => {
    console.log("Checking configuration...");

    const requiredEnvVars = [
    "CONFORMANCE_API",
    "DB_CONNECTION_STRING"
    ];

    const missingEnvVars = requiredEnvVars.filter(name => !process.env[name]);
    if (missingEnvVars.length > 0) {
        console.error("Missing environment variables:");
        missingEnvVars.forEach(name => console.error(` - ${name}`));
        process.exit(1);
    }
    console.log("All required environment variables are set.");

    console.log("Checking database...");
    await checkConnection();
    console.log("Database connection OK.");

    logger.warn("If you see this message, logging is configured correctly.");

    console.log("Configuration check completed successfully.");
    process.exit(0);
})();

