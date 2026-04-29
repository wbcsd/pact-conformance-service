import Ajv from "ajv";
import addFormats from "ajv-formats";
import betterErrors from "ajv-errors";
import config from "../config";
import { ApiVersion, TestRun, TestCaseResultStatus, TestResult } from "../services/types";
import { VersionSchema } from "../schemas";

export interface TestContext {
  testRunId: string;
  baseUrl: string;
  authTokenUrl: string;
  accessToken: string;
  headers: Record<string, string>;
  clientId: string;
  clientSecret: string;
  authRequestData: string;
  version: ApiVersion;
  webhookUrl: string;
  footprints: any;
  paginationLinks: Record<string, string>;
  schema: any;
  filterParams: any;
}

export interface ListenerContext {
  testRun: TestRun;
  version: ApiVersion;
  path: string;
  method: string;
  headers: Record<string, string>;
  data: any;
  schema: VersionSchema;
}

export interface TestDefinition {
  action: (ctx: TestContext) => Promise<TestResult>;
  listener: (ctx: ListenerContext) => Promise<TestResult>;
  testName: string;
  testKey: string;
  testNumber: number | null;
}

export interface TestCaseInstance {
  request: { url: string; method: string; headers: Record<string, string>; body?: any };
  response: { status: number; data: any; text: string };
  messages?: string[];
}

export const createTest = (
  testName: string,
  url: string,
  action: (ctx: TestContext) => Promise<Partial<TestResult> | void>,
): TestDefinition => {
  const testKey = testName.toUpperCase().replace(/^TEST CASE (\d+).*/, "TESTCASE#$1");
  const testNumber = parseInt(testKey.slice("TESTCASE#".length)) || null;
  return {
    action: async (ctx: TestContext): Promise<TestResult> => {
      const result: TestResult = {
        name: testName,
        status: TestCaseResultStatus.SUCCESS,
        mandatory: true,
        testKey,
        documentationUrl: url,
      };

      try {
        const extra = await action(ctx);
        const result: TestResult = {
          name: testName,
          status: TestCaseResultStatus.SUCCESS,
          mandatory: true,
          testKey,
          documentationUrl: url,
          ...extra,
        };
        return result;
      } catch (error: any) {
        return {
          name: testName,
          status: TestCaseResultStatus.FAILURE,
          mandatory: true,
          testKey,
          documentationUrl: url,
          errorMessage: error.message,
        }
      }
    },
    testKey,
    testName,
    testNumber,
  } as TestDefinition;
}

export const createListenerTest = (
  testName: string,
  url: string,
  listener: (ctx: ListenerContext) => Promise<Partial<TestResult> | void>,
): TestDefinition => {
  const testKey = testName.toUpperCase().replace(/^TEST CASE (\d+(\.\w+)?).*/, "TESTCASE#$1");
  const testNumber = parseInt(testKey.slice("TESTCASE#".length)) || null;
  return {
    listener: async (ctx: ListenerContext): Promise<TestResult> => {
      try {
        const extra = await listener(ctx);
        const result: TestResult = {
          name: testName,
          status: TestCaseResultStatus.SUCCESS,
          mandatory: true,
          testKey,
          documentationUrl: url,
          ...extra,
        };
        return result;
      } catch (error: any) {
        return {
          name: testName,
          status: TestCaseResultStatus.FAILURE,
          mandatory: true,
          testKey,
          documentationUrl: url,
          errorMessage: error.message,
        };
      }
    },testKey,
    testName,
    testNumber,
  } as TestDefinition;
};


export const makeRequest = async (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ status: number; data: any; text: string }> => {
  const response = await fetch(url, {
    method,
    body,
    headers,
    signal: AbortSignal.timeout(config.TESTCASE_TIMEOUT),
  });

  const text = await response.text();
  let data = null;

  if (text && response.headers.get("Content-Type")?.includes("application/json")) {
    data = JSON.parse(text);
  }

  return { status: response.status, data, text };
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

