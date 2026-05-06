import Ajv from "ajv";
import addFormats from "ajv-formats";
import betterErrors from "ajv-errors";
import config from "../config";
import { ApiVersion, LogEntry, TestRun, TestCaseResultStatus, TestResult, TestRunStartParams } from "../services/types";
import { VersionSchema } from "../schemas";

interface Response {
  status: number; 
  headers: Record<string, string>;
  data: any; // JSON-parsed response body, or undefined if not JSON
  text: string; // Raw response text, useful for error messages and debugging
}
/** 
 * Base context class with common logging functionality, which is 
 * extended by both TestContext and ListenerContext.
 */
class TestContextBase {
  public log: LogEntry[] = [];

  constructor(
    public readonly testRun: TestRun, 
    public readonly schema: VersionSchema,
  ) {}

    /** 
   * Log informational messages from tests, which 
   * will be included in the test results.
   * @param message The informational message to log
   */
  public info(message: string): void {
    this.log.push({ message });
  }

  /** 
   * Log warning messages from tests, which will be included 
   * in the test results.
   * @param message The warning message to log
   */
  public warn(message: string): void {
    this.log.push({ warning: message });
  }

  /** 
   * Log error messages from tests, which will be included 
   * in the test results.
   * @param message The error message to log
   */
  public error(message: string): void {
    this.log.push({ error: message });
  }

  /** 
   * Log HTTP requests made by tests, which will be included in the test results.
   * This should be called by tests whenever they make an HTTP request, to ensure the request details are captured in the logs.
   * @param method The HTTP method of the request (e.g. "GET", "POST")
   * @param url The URL of the request
   * @param headers Optional headers sent with the request
   * @param body Optional body sent with the request, which can be a string or an object (which will be JSON-stringified)
   */
  public logRequest(method: string, url: string, headers?: Record<string, string>, body?: any | string | undefined): void {
    const logEntry: LogEntry = { request: { method, url, headers: headers ?? {}, data: body } };
    if (body !== undefined && body !== null && typeof body === "string") {
      logEntry.request.text = body;
      delete logEntry.request.data;
    }
    this.log.push(logEntry);
  }

  /** 
   * Log HTTP responses received by tests, which will be included in the test results.
   * This should be called by tests whenever they receive an HTTP response, to
   * ensure the response details are captured in the logs.
   * @param statusCode The HTTP status code of the response
   * @param headers The headers received in the response
   * @param data Optional JSON-parsed body of the response, if the response was JSON
   * @param text Optional raw text of the response body, useful for error messages and debugging (if data is not provided)
   */
  public logResponse(statusCode: number, headers: Record<string, string>, data?: any, text?: string): void {
    const logEntry: LogEntry = { response: { statusCode, headers } };
    if (data !== undefined) {
      logEntry.response.data = data;
    } else if (text) {
      logEntry.response.text = text;
    }
    this.log.push(logEntry);
  }
}

/**
 * Context class used for regular tests, which has helper functions 
 * for making requests and logging messages
 */
export class TestContext extends TestContextBase {
  public authTokenUrl: string = "";
  public accessToken = "";
  public authRequestData = "";
  public headers: Record<string, string> = {};
  public response?: Response;
  public footprints: any[] = [];
  public filterParams: any;
  public paginationLinks: Record<string, string> = {};
  public webhookUrl = config.CONFORMANCE_API;

  constructor(
    public readonly testRun: TestRun, 
    public readonly startParams: TestRunStartParams,
    public readonly schema: VersionSchema,
    public baseUrl = startParams.baseUrl,
  ) { 
    super(testRun, schema);
  }

  // Resets the context's response and log. will be called each time 
  // before running a test.
  public reset() {
    this.response = undefined;
    this.log = [];
  }

  // Helper to make HTTP requests, which automatically logs the request 
  // and response details in the context's log.
  public async request(url: string, method: string, headers?: Record<string, string>, body?: any | string | undefined): Promise<Response> {

    // Merge any headers provided in the request with the context's existing headers (e.g. auth headers set by init tests)
    const effectiveHeaders = headers ?? (this.headers as Record<string, string>);

    this.logRequest(method, url, effectiveHeaders, body);
    
    // Make sure to stringify the body if it's an object
    if (body !== undefined && body !== null && typeof body !== "string") {
      body = JSON.stringify(body);
    }

    // Make the HTTP request, capturing any errors and logging them
    let response: Response;
    try {
      const raw = await fetch(url, {
        method,
        body,
        headers: effectiveHeaders,
        signal: AbortSignal.timeout(config.TESTCASE_TIMEOUT),
      });

      // Convert headers from Headers object to plain Record<string, string>.
      // Normalize all header names to lowercase to match the HTTP spec and the real
      // fetch Headers API, which guarantees case-insensitive access.
      response = { 
        status: raw.status, 
        headers: Object.fromEntries(Array.from(raw.headers.entries()).map(([k, v]) => [k.toLowerCase(), v])),
        text: await raw.text(),
        data: undefined, // We'll attempt to parse JSON below; if it fails, we'll just keep this as undefined
      };
      if (response.text && response.headers["content-type"]?.includes("application/json")) {
        response.data = JSON.parse(response.text);
      }
    } catch (err: any) {
      this.log.push({ error: err.message });
      throw err;
    }

    this.logResponse(response.status, response.headers, response.data, response.text);

    this.response = response;
    return response;
  }
}

/**
 * Context class used for listener tests, which has access to the 
 * event payload and request details
 */
export class ListenerContext extends TestContextBase {

  constructor(
    public testRun: TestRun,
    public version: ApiVersion,
    public path: string,
    public method: string,
    public headers: Record<string, string>,
    public data: any,
    public schema: VersionSchema,
  ) {
    super(testRun, schema);
  }
}

export interface TestDefinition {
  action?: (ctx: TestContext) => Promise<void>;
  listener?: (ctx: ListenerContext) => Promise<void>;
  optional?: ApiVersion[];
  documentationUrl: string;
  testName: string;
  testKey: string;
  testNumber: number | null;
  isInit?: true;
}

// Create a test case  for a regular test, which will be
// executed in the main test loop
export const createTest = (
  testName: string,
  url: string,
  action: (ctx: TestContext) => Promise<void>,
  optional?: ApiVersion[]
): TestDefinition => {
  const testKey = testName.toUpperCase().replace(/^TEST CASE (\d+).*/, "TESTCASE#$1");
  const testNumber = parseInt(testKey.slice("TESTCASE#".length)) || null;
  return { action, documentationUrl: url, testKey, testName, testNumber, optional: optional };
};

// Create a test case for a listener test, which will be executed
// in response to an event callback
export const createListenerTest = (
  testName: string,
  url: string,
  listener: (ctx: ListenerContext) => Promise<void>,
  optional?: ApiVersion[]
): TestDefinition => {
  const testKey = testName.toUpperCase().replace(/^TEST CASE (\d+(\.\w+)?).*/, "TESTCASE#$1");
  const testNumber = parseInt(testKey.slice("TESTCASE#".length)) || null;
  return { listener, documentationUrl: url, testKey, testName, testNumber, optional: optional };
};

// Create a test case for an initialization test, which will always
// be executed at the beginning of the test run, before the regular tests.
export const createInitTest = (
  testName: string,
  url: string,
  action: (ctx: TestContext) => Promise<void>,
): TestDefinition => {
  const testKey = testName.toUpperCase().replace(/^TEST CASE (\d+).*/, "TESTCASE#$1");
  const testNumber = parseInt(testKey.slice("TESTCASE#".length)) || null;
  return { action, documentationUrl: url, testKey, testName, testNumber, isInit: true };
};

export const runTest = async (test: TestDefinition, ctx: TestContext): Promise<TestResult> => {
  ctx.reset();
  ctx.log.push({ message: `Starting test case execution: ${test.testKey}` });
  try {
    await test.action!(ctx);
    ctx.log.push({ message: `Test case ${test.testKey} executed successfully` });
    return {
      name: test.testName,
      status: TestCaseResultStatus.SUCCESS,
      mandatory: test.optional?.includes(ctx.startParams.version) ? false : true,
      testKey: test.testKey,
      documentationUrl: test.documentationUrl,
      log: ctx.log,
    };
  } catch (error: any) {
    ctx.log.push({ error: error.message });
    return {
      name: test.testName,
      status: TestCaseResultStatus.FAILURE,
      mandatory: test.optional?.includes(ctx.startParams.version) ? false : true,
      testKey: test.testKey,
      documentationUrl: test.documentationUrl,
      errorMessage: error.message,
      log: ctx.log,
    };
  }
};

export const runListenerTest = async (test: TestDefinition, ctx: ListenerContext): Promise<TestResult> => {
  ctx.log.push({ message: `Starting test case execution: ${test.testKey}` });
  try {
    await test.listener!(ctx);
    ctx.log.push({ message: `Test case ${test.testKey} executed successfully` });
    return {
      name: test.testName,
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: test.testKey,
      documentationUrl: test.documentationUrl,
      log: ctx.log,
    };
  } catch (error: any) {
    ctx.log.push({ error: error.message });
    return {
      name: test.testName,
      status: TestCaseResultStatus.FAILURE,
      mandatory: true,
      testKey: test.testKey,
      documentationUrl: test.documentationUrl,
      errorMessage: error.message,
      log: ctx.log,
    };
  }
};

export const assert = (condition: boolean, failureMessage: string): void => {
  if (!condition) {
    throw new Error(failureMessage);
  }
};

export const assertIncluded = <T>(value: T, array: T[] | T): void => {
  if (!Array.isArray(array)) {
    array = [array];
  }
  if (!array.includes(value)) {
    throw new Error(`Expected value ${value} to be in [${array}]`);
  }
};

export const assertStatus = assertIncluded<number>;

export const assertNotNull = (value: any, failureMessage: string) => {
  if (value === null || value === undefined || value === "" || !!value === false) {
    throw new Error(failureMessage);
  }
};

const validateSchema = (data: any, schema: any): { valid: boolean; errors?: string } => {
  if (!schema) return { valid: true };

  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  betterErrors(ajv);
  const validate = ajv.compile(schema);

  if (!validate(data)) {
    return {
      valid: false,
      errors: validate.errors?.map((e) => e.message).join(", "),
    };
  }

  return { valid: true };
};

export const assertSchema = (data: any, schema: any): void => {
  const schemaValidation = validateSchema(data, schema);
  assert(
    schemaValidation.valid,
    `Schema validation failed: ${schemaValidation.errors ?? "Unknown error"}`
  );
};

