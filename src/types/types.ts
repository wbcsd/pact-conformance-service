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

export enum TestCaseNames {
  AUTHENTICATE_WITH_INCORRECT_CREDENTIALS = "Authenticate with incorrect credentials",
}

export interface TestRun {
  testId: string;
  timestamp: number;
  testCases: TestCaseResult[];
}
interface TestCaseResult {
  name: string;
  status: TestCaseResultStatus;
  message?: string;
}

export interface TestCase {
  name: string;
  callback?: boolean;
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint?: string;
  expectedStatusCodes?: number[];
  schema?: object;
  requestData?: any;
  condition?: (response: any, responseHeaders: Headers) => boolean;
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

export enum EventTypes {
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

export type ApiVersion = "V2.0" | "V2.1" | "V2.2" | "V2.3" | "V3.0";
