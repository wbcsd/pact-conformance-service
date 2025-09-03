import dotenv from "dotenv";

// Load environment variables from .env files
dotenv.config();

// Helper to get and validate required vars
function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

/* eslint-disable n/no-process-env */
export default {
  NODE_ENV: getEnvVar("NODE_ENV"),
  PORT: getEnvVar("PORT"),
  DB_CONNECTION_STRING: getEnvVar("DB_CONNECTION_STRING"),
  CONFORMANCE_API: getEnvVar("CONFORMANCE_API"),
  TESTCASE_TIMEOUT: Number(process.env.TESTCASE_TIMEOUT ?? 5000),
  LOG_OUTPUT: process.env.LOG_OUTPUT ?? "pino",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  JWT_EXP: Number(process.env.JWT_EXP ?? 0),
};
