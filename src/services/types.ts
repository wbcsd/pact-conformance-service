// TODO: Get these from OpenAPI spec directly
export type ApiVersion = "V2.0" | "V2.1" | "V2.2" | "V2.3" | "V3.0";

export enum EventTypesV2 {
  CREATED = "org.wbcsd.pathfinder.ProductFootprintRequest.Created.v1",
  FULFILLED = "org.wbcsd.pathfinder.ProductFootprintRequest.Fulfilled.v1",
  REJECTED = "org.wbcsd.pathfinder.ProductFootprintRequest.Rejected.v1",
  PUBLISHED = "org.wbcsd.pathfinder.ProductFootprint.Published.v1",
}

export enum EventTypesV3 {
  CREATED = "org.wbcsd.pact.ProductFootprint.RequestCreatedEvent.3",
  FULFILLED = "org.wbcsd.pact.ProductFootprint.RequestFulfilledEvent.3",
  REJECTED = "org.wbcsd.pact.ProductFootprint.RequestRejectedEvent.3",
  PUBLISHED = "org.wbcsd.pact.ProductFootprint.PublishedEvent.3",
}

// Constants for test run status
export enum TestRunStatus {
  PASS = "PASS",
  FAIL = "FAIL",
  PENDING = "PENDING",
}

// Constants for test result status
export enum TestCaseResultStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
}

export interface TestCase {
  name: string;
  callback?: boolean;
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint?: string;
  expectedStatusCodes?: number[];
  schema?: object;
  requestData?: any;
  condition?: (body: any, messages: string[]) => boolean;
  conditionErrorMessage?: string;
  headers?: Record<string, string>;
  customUrl?: string;
  mandatoryVersion?: ApiVersion[];
  testKey: string;
  documentationUrl?: string;
  expectHttpError?: boolean;
}

export interface TestResult {
  name: string;
  status: TestCaseResultStatus;
  errorMessage?: string;
  apiResponse?: string;
  mandatory: boolean;
  testKey: string;
  curlRequest?: string;
  documentationUrl?: string;
}

export interface TestData {
  productIds: string[];
  version: string;
}

export interface TestRunStartParams {
  baseUrl: string;
  version: ApiVersion;
  clientId: string;
  clientSecret: string;
  organizationName: string;
  adminEmail: string;
  adminName: string;
  customAuthBaseUrl?: string;
  scope?: string;
  audience?: string;
  resource?: string;
}

export interface TestRun {
  testRunId: string;
  organizationName: string;
  adminEmail: string;
  adminName: string;
  timestamp: string;
  status: string;
  techSpecVersion: string;
  passingPercentage?: number;
}

// TODO: Rename to TestRunDetailsWithResults and extend TestRunDetails after testId naming is fixed
export interface TestRunWithResults extends TestRun {
  results: TestResult[];
}


/**
 * Interface representing a storage mechanism for managing test runs, 
 * test results, and related data.
 * This can be implemented using different storage backends, like a database,
 * but could also be output to files or the console for simpler use cases.
 * For a one-off test run, a simple console or file-based implementation might suffice.
 * For persistent storage and historical data, a database implementation is recommended.
 */
export interface TestStorage {
  /**
   * Saves the details of a test run.
   * @param details - The details of the test run to save.
   * @returns A promise that resolves when the operation is complete.
   */
  saveTestRun(details: Omit<TestRun, "timestamp">): Promise<void>;

  /**
   * Updates the status of a test run.
   * @param testRunId - The unique identifier of the test run.
   * @param status - The new status of the test run.
   * @param passingPercentage - The percentage of tests that passed in the test run.
   * @returns A promise that resolves when the operation is complete.
   */
  updateTestRunStatus(
    testRunId: string,
    status: string,
    passingPercentage: number
  ): Promise<void>;

  /**
   * Saves the result of a single test case.
   * @param testRunId - The unique identifier of the test run.
   * @param testResult - The result of the test case to save.
   * @param overwriteExisting - Whether to overwrite an existing result for the same test case.
   * @returns A promise that resolves when the operation is complete.
   */
  saveTestCaseResult(
    testRunId: string,
    testResult: TestResult,
    overwriteExisting: boolean
  ): Promise<void>;

  /**
   * Saves the results of multiple test cases.
   * @param testRunId - The unique identifier of the test run.
   * @param testResults - An array of test case results to save.
   * @returns A promise that resolves when the operation is complete.
   */
  saveTestCaseResults(
    testRunId: string,
    testResults: TestResult[]
  ): Promise<void>;

  /**
   * Retrieves the test results for a specific test run.
   * @param testRunId - The unique identifier of the test run.
   * @returns A promise that resolves with the test run and its results, or null if not found.
   */
  getTestResults(testRunId: string): Promise<TestRunWithResults | null>;

  /**
   * Saves additional data associated with a test run.
   * @param testRunId - The unique identifier of the test run.
   * @param testData - The test data to save.
   * @returns A promise that resolves when the operation is complete.
   */
  saveTestData(testRunId: string, testData: TestData): Promise<void>;

  /**
   * Retrieves additional data associated with a test run.
   * @param testRunId - The unique identifier of the test run.
   * @returns A promise that resolves with the test data, or null if not found.
   */
  getTestData(testRunId: string): Promise<TestData | null>;

  /**
   * Lists test runs with optional filtering and pagination.
   * @param adminEmail - (Optional) The email of the admin to filter test runs by.
   * @param searchTerm - (Optional) A search term to filter test runs by.
   * @param page - (Optional) The page number for pagination.
   * @param pageSize - (Optional) The number of test runs per page.
   * @returns A promise that resolves with an array of test run details.
   */
  listTestRuns(
    adminEmail?: string,
    searchTerm?: string,
    page?: number,
    pageSize?: number
  ): Promise<TestRun[]>;
}
