import { ApiVersion, LogEntry, TestRun, TestRunStartParams } from "../types";
import { VersionSchema } from "../schemas";

const TESTCASE_TIMEOUT = Number(process.env.TESTCASE_TIMEOUT ?? 5000);

export interface Response {
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
   */
  public info(message: string): void {
    this.log.push({ message });
  }

  /**
   * Log warning messages from tests, which will be included
   * in the test results.
   */
  public warn(message: string): void {
    this.log.push({ warning: message });
  }

  /**
   * Log error messages from tests, which will be included
   * in the test results.
   */
  public error(message: string): void {
    this.log.push({ error: message });
  }

  /**
   * Log HTTP requests made by tests, included in the test results. Tests should
   * call this whenever they make an HTTP request, to ensure request details are
   * captured in the logs.
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
   * Log HTTP responses received by tests, included in the test results. Tests should
   * call this whenever they receive an HTTP response, to ensure response details are
   * captured in the logs.
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
 * Context class used for regular tests, providing helper functions
 * for making requests and logging messages.
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
  public webhookUrl: string;

  constructor(
    public readonly testRun: TestRun,
    public readonly startParams: TestRunStartParams,
    public readonly schema: VersionSchema,
    webhookUrl: string,
    public baseUrl = startParams.baseUrl,
  ) {
    super(testRun, schema);
    this.webhookUrl = webhookUrl;
  }

  // Resets the context's response and log; called before each test runs.
  public reset() {
    this.response = undefined;
    this.log = [];
  }

  // Helper to make HTTP requests, automatically logging request and response details.
  public async request(url: string, method: string, headers?: Record<string, string>, body?: any | string | undefined): Promise<Response> {

    // Merge any provided headers with the context's existing headers (e.g. auth headers set by init tests)
    const effectiveHeaders = headers ?? (this.headers as Record<string, string>);

    this.logRequest(method, url, effectiveHeaders, body);

    if (body !== undefined && body !== null && typeof body !== "string") {
      body = JSON.stringify(body);
    }

    let response: Response;
    try {
      const raw = await fetch(url, {
        method,
        body,
        headers: effectiveHeaders,
        signal: AbortSignal.timeout(TESTCASE_TIMEOUT),
      });

      // Normalize header names to lowercase to match the HTTP spec and the real
      // fetch Headers API, which guarantees case-insensitive access.
      response = {
        status: raw.status,
        headers: Object.fromEntries(Array.from(raw.headers.entries()).map(([k, v]) => [k.toLowerCase(), v])),
        text: await raw.text(),
        data: undefined,
      };
      if (response.text && response.headers["content-type"]?.includes("application/json")) {
        response.data = JSON.parse(response.text);
      }
    } catch (err: any) {
      this.log.push({ error: err.message + (err.cause?.message ? `: ${err.cause.message}` : "") });
      throw err;
    }

    this.logResponse(response.status, response.headers, response.data, response.text);

    this.response = response;
    return response;
  }
}

/**
 * Context class used for listener tests, with access to the event payload
 * and request details.
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
