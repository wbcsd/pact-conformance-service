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
 *   --output           Path to write the full test results as JSON
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { Server } from "http";
import { randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { TestRunWorker } from "./runner/test-run-worker";
import { ConsoleTestStorage } from "./runner/console-test-storage";
import { ApiVersion, TestCaseResultStatus, TestRunStartParams, TestRunWithResults } from "./types";
import logger from "./logger";

const PORT = process.env.PORT ?? "8080";
// Public URL of the callback listener that the tested API will post events to.
// Defaults to the loopback URL the CLI listens on, which works when the tested API
// runs on the same host (e.g. local development).
const CONFORMANCE_API = process.env.CONFORMANCE_API ?? `http://localhost:${PORT}`;

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

/**
 * Defines the expected command-line arguments for the test run, including required parameters
 */
type CommandLineArguments = TestRunStartParams & {
  verbose: boolean;
  insecure: boolean;
  output?: string;
};

/**
 * Parses command-line arguments and returns them as a structured object.
 * @returns {CommandLineArguments} The parsed command-line arguments
 */
function parseArgs(): CommandLineArguments {
  const args = process.argv.slice(2);
  const params: Partial<CommandLineArguments> = {
    adminEmail: "cli@example.com",
    adminName: "CLI User",
    verbose: false,
    insecure: false,
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
      case "--output": {
        if (!value || value.startsWith("--")) {
          usageError("--output requires a <path> value");
        }
        params.output = value;
        i++;
        break;
      }
      case "--verbose":
        params.verbose = true;
        break;
      case "--insecure":
        params.insecure = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith("--")) {
          usageError(`Unknown argument: ${arg}`);
        }
    }
  }

  // Validate required parameters
  const required = ["baseUrl", "clientId", "clientSecret", "version", "organizationName"];
  const missing = required.filter((key) => !params[key as keyof TestRunStartParams]);

  if (missing.length > 0) {
    usageError(`Missing required arguments: ${missing.join(", ")}`);
  }

  return params as CommandLineArguments;
}

// Report an invalid command line: a concise error on stderr plus a pointer to
// --help, then exit. Full help is reserved for an explicit --help request so a
// simple mistake (like a missing value) isn't buried under the whole usage text.
function usageError(message: string): never {
  console.error(`error: ${message}`);
  console.error("Run with --help for usage.");
  process.exit(1);
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
  --output <path>              Write the full test results (run metadata + all results) as JSON to this file
  --verbose                    Show logs for passing tests in addition to failing ones
  --insecure                   Disable TLS certificate verification (not recommended; use only for localhost testing)  
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

/**
 * Spins up an Express listener on `PORT` to receive callback events from the
 * tested API during a test run. The listener exposes:
 *   - POST /auth/token : returns a stub access token to any caller presenting Basic auth.
 *     The token is opaque to us — handleCallback does not validate it — so this only needs
 *     to satisfy the spec's OAuth2 client-credentials response shape.
 *   - POST /2/events, /3/events : forwarded to TestRunWorker.handleCallback, which
 *     correlates each event to the originating async test case via requestEventId.
 */
function startCallbackListener(worker: TestRunWorker): Promise<Server> {
  const app = express();
  app.use(express.json({ type: ["application/json", "application/cloudevents+json"] }));

  app.post("/auth/token", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      res.status(401).json({ code: "Unauthorized", message: "Missing or invalid Basic Authorization header" });
      return;
    }
    res.json({ access_token: randomBytes(24).toString("hex"), token_type: "Bearer", expires_in: 3600 });
  });

  app.post(["/2/events", "/3/events"], async (req, res, next) => {
    try {
      await worker.handleCallback(req);
      res.status(200).send();
    } catch (err: any) {
      const status = typeof err.status === "number" ? err.status : 500;
      res.status(status).json({ code: err.code ?? "InternalError", message: err.message });
      next(err);
    }
  });

  const port = Number(PORT);
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.info(`Callback listener running on port ${port}`);
      resolve(server);
    });
    server.once("error", reject);
  });
}

/**
 * After the synchronous test phase completes, async callback tests may still be PENDING
 * while waiting for the tested API to respond. Poll storage until none remain or we hit
 * the timeout.
 */
async function waitForPendingCallbacks(
  storage: ConsoleTestStorage,
  testRunId: string,
  timeoutMs: number,
  pollIntervalMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await storage.getTestRunWithResults(testRunId);
    const pending = run.results.some((r) => r.mandatory && r.status === TestCaseResultStatus.PENDING);
    if (!pending) return;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  logger.warn(`Timed out after ${timeoutMs}ms waiting for callback events; some test cases remain PENDING.`);
}

async function main() {
  let server: Server | undefined;
  let exitCode = 1;
  try {
    // Parse arguments first so a usage error isn't preceded by the banner,
    // which would make a rejected command look like a run that started.
    const args = parseArgs();

    logger.info("PACT Conformance Test CLI");
    logger.info("=".repeat(80));

    // Disable TLS certificate verification if --insecure flag is set
    if (args.insecure) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      logger.warn("TLS certificate verification is disabled for this process.");
    }

    // Create console-based storage (no database)
    const storage = new ConsoleTestStorage(args.verbose);

    // Create test run worker
    const worker = new TestRunWorker(storage, CONFORMANCE_API);

    // Start the callback listener before running tests so async events sent during
    // the test run are received and correlated to their pending test cases.
    server = await startCallbackListener(worker);

    // Start the test run
    logger.info("Starting test run...\n");
    const initial = await worker.startTestRun(args);

    // Wait for any callback-driven tests that are still PENDING after the sync phase.
    if (initial.results.some((r) => r.mandatory && r.status === TestCaseResultStatus.PENDING)) {
      logger.info("Waiting for asynchronous callback events...");
      await waitForPendingCallbacks(storage, initial.testRunId, 60_000);
    }

    // Update final status based on any changes from callback events
    await storage.updateTestRunStatus(initial.testRunId);

    // Write the full results to a file if requested
    if (args.output) {
      const outputPath = resolve(args.output);
      if (!outputPath.toLowerCase().endsWith(".json")) {
        logger.warn(`Output path "${outputPath}" does not end in .json; writing JSON content anyway.`);
      }
      const runWithResults = await storage.getTestRunWithResults(initial.testRunId);
      // The run record carries the full start params plus CLI-internal flags.
      // Strip credentials and internal fields so they are never written to disk.
      const {
        clientId,
        clientSecret,
        verbose,
        insecure,
        output,
        results,
        ...runMeta
      } = runWithResults as TestRunWithResults & Record<string, unknown>;
      const sanitizedResults = {
        ...runMeta,
        results: results.map(({ log, ...r }) => r),
      };
      writeFileSync(outputPath, JSON.stringify(sanitizedResults, null, 2));
      logger.info(`Test results written to ${outputPath}`);
    }

    // Display results in console
    storage.displayTestResults(initial.testRunId);
    if (args.testCaseNumbers?.length) {
      logger.info("WARNING: Some test cases may have been excluded (see --testCases argument)");
    }
    const result = await storage.getTestRun(initial.testRunId);
    exitCode = result.status === "PASS" ? 0 : 1;

  } catch (error: any) {
    logger.error("Error running tests:", error);
    exitCode = 1;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
  }
  process.exit(exitCode);
}

// Run the CLI
main();
