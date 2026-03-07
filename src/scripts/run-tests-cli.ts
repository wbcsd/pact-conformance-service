#!/usr/bin/env node

/**
 * Command-line interface for running PACT conformance tests.
 * 
 * This script allows you to run tests from the command line without needing
 * a database or running the full server. Results are displayed in the console.
 * 
 * Usage:
 *   npx tsx src/scripts/run-tests-cli.ts --baseUrl https://api.example.com \
 *     --clientId myClientId --clientSecret mySecret --version V3.0 \
 *     --organizationName "My Company"
 * 
 * Required arguments:
 *   --baseUrl           Base URL of the API to test
 *   --clientId          OAuth client ID
 *   --clientSecret      OAuth client secret
 *   --version           PACT version (V2.0, V2.1, V2.2, V2.3, or V3.0)
 *   --organizationName  Name of the organization being tested
 * 
 * Optional arguments:
 *   --customAuthBaseUrl Custom auth base URL (if different from baseUrl)
 *   --scope            OAuth scope
 *   --audience         OAuth audience
 *   --resource         OAuth resource
 *   --adminEmail       Admin email address
 *   --adminName        Admin name
 */

import { TestRunWorker } from "../services/test-run-worker";
import { ConsoleTestStorage } from "../services/console-test-storage";
import { ApiVersion, TestRunStartParams } from "../services/types";
import logger from "../utils/logger";

/**
 * Parses a comma-separated list of test case numbers and ranges (e.g. "1-2,9" -> [1, 2, 9]).
 */
function parseTestCaseList(raw: string): number[] {
  const result: number[] = [];
  for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const dash = part.indexOf("-");
    if (dash >= 0) {
      const lo = parseInt(part.slice(0, dash).trim(), 10);
      const hi = parseInt(part.slice(dash + 1).trim(), 10);
      if (!Number.isNaN(lo) && !Number.isNaN(hi) && lo <= hi) {
        for (let n = lo; n <= hi; n++) result.push(n);
      }
    } else {
      const n = parseInt(part, 10);
      if (!Number.isNaN(n)) result.push(n);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}

function parseArgs(): TestRunStartParams {
  const args = process.argv.slice(2);
  const params: Partial<TestRunStartParams> = {
    adminEmail: "cli@example.com",
    adminName: "CLI User",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case "--baseUrl":
        params.baseUrl = value;
        i++;
        break;
      case "--clientId":
        params.clientId = value;
        i++;
        break;
      case "--clientSecret":
        params.clientSecret = value;
        i++;
        break;
      case "--version":
        params.version = value as ApiVersion;
        i++;
        break;
      case "--organizationName":
        params.organizationName = value;
        i++;
        break;
      case "--customAuthBaseUrl":
        params.customAuthBaseUrl = value;
        i++;
        break;
      case "--scope":
        params.scope = value;
        i++;
        break;
      case "--audience":
        params.audience = value;
        i++;
        break;
      case "--resource":
        params.resource = value;
        i++;
        break;
      case "--adminEmail":
        params.adminEmail = value;
        i++;
        break;
      case "--adminName":
        params.adminName = value;
        i++;
        break;
      case "--testCases": {
        const raw = value ?? "";
        params.testCaseNumbers = parseTestCaseList(raw);
        i++;
        break;
      }
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith("--")) {
          logger.error(`Unknown argument: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  // Validate required parameters
  const required = ["baseUrl", "clientId", "clientSecret", "version", "organizationName"];
  const missing = required.filter((key) => !params[key as keyof TestRunStartParams]);

  if (missing.length > 0) {
    logger.error(`Missing required arguments: ${missing.join(", ")}`);
    printHelp();
    process.exit(1);
  }

  return params as TestRunStartParams;
}

function printHelp(): void {
  console.log(`
PACT Conformance Test CLI

Usage:
  npx tsx src/scripts/run-tests-cli.ts [options]

Required Options:
  --baseUrl <url>              Base URL of the API to test
  --clientId <id>              OAuth client ID
  --clientSecret <secret>      OAuth client secret
  --version <version>          PACT version (V2.0, V2.1, V2.2, V2.3, or V3.0)
  --organizationName <name>    Name of the organization being tested

Optional Options:
  --customAuthBaseUrl <url>    Custom auth base URL (if different from baseUrl)
  --scope <scope>              OAuth scope
  --audience <audience>        OAuth audience
  --resource <resource>        OAuth resource
  --adminEmail <email>         Admin email address (default: cli@example.com)
  --adminName <name>           Admin name (default: CLI User)
  --testCases <list>           Comma-separated numbers and ranges (e.g. 1-2,9). Omit to run all.
  --help, -h                   Show this help message

Examples:
  # Run V3.0 tests
  npx tsx src/scripts/run-tests-cli.ts \\
    --baseUrl https://api.example.com \\
    --clientId myClientId \\
    --clientSecret mySecret \\
    --version V3.0 \\
    --organizationName "My Company"

  # Run V2.2 tests with custom auth URL
  npx tsx src/scripts/run-tests-cli.ts \\
    --baseUrl https://api.example.com \\
    --customAuthBaseUrl https://auth.example.com \\
    --clientId myClientId \\
    --clientSecret mySecret \\
    --version V2.2 \\
    --organizationName "My Company" \\
    --scope "read:footprints"

  # Run only test cases 1, 2, and 9
  npx tsx src/scripts/run-tests-cli.ts \\
    --baseUrl https://api.example.com \\
    --clientId myClientId \\
    --clientSecret mySecret \\
    --version V3.0 \\
    --organizationName "My Company" \\
    --testCases 1-2,9
  `);
}

async function main() {
  try {
    logger.info("PACT Conformance Test CLI");
    logger.info("=".repeat(80));

    const params = parseArgs();

    // Create console-based storage (no database)
    const storage = new ConsoleTestStorage();

    // Create test run worker
    const worker = new TestRunWorker(storage);

    // Start the test run
    logger.info("Starting test run...\n");
    const result = await worker.startTestRun(params);

    // Display final results
    logger.info("\n" + "=".repeat(80));
    logger.info("TEST RUN COMPLETE");
    logger.info("=".repeat(80));
    logger.info(`Status: ${result.status}`);
    logger.info(`Passing Percentage: ${result.passingPercentage}%`);
    logger.info(`Total Tests: ${result.results.length}`);
    logger.info("=".repeat(80));

    // Exit with appropriate code
    if (result.status === "PASS") {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error: any) {
    logger.error("Error running tests:", error);
    process.exit(1);
  }
}

// Run the CLI
main();
