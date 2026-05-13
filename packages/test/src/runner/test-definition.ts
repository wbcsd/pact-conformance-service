import { ApiVersion, TestCaseResultStatus, TestResult } from "../types";
import { ListenerContext, TestContext } from "./test-context";

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

// Create a regular test case, which will be executed in the main test loop.
export const createTest = (
  testName: string,
  url: string,
  action: (ctx: TestContext) => Promise<void>,
  optional?: ApiVersion[]
): TestDefinition => {
  const testKey = testName.toUpperCase().replace(/^TEST CASE (\d+).*/, "TESTCASE#$1");
  const testNumber = parseInt(testKey.slice("TESTCASE#".length)) || null;
  return { action, documentationUrl: url, testKey, testName, testNumber, optional };
};

// Create a listener test case, which will be executed in response to an event callback.
export const createListenerTest = (
  testName: string,
  url: string,
  listener: (ctx: ListenerContext) => Promise<void>,
  optional?: ApiVersion[]
): TestDefinition => {
  const testKey = testName.toUpperCase().replace(/^TEST CASE (\d+(\.\w+)?).*/, "TESTCASE#$1");
  const testNumber = parseInt(testKey.slice("TESTCASE#".length)) || null;
  return { listener, documentationUrl: url, testKey, testName, testNumber, optional };
};

// Create an initialization test, executed at the start of the test run before regular tests.
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
      mandatory: test.optional?.includes(ctx.version) ? false : true,
      testKey: test.testKey,
      documentationUrl: test.documentationUrl,
      log: ctx.log,
    };
  } catch (error: any) {
    ctx.log.push({ error: error.message });
    return {
      name: test.testName,
      status: TestCaseResultStatus.FAILURE,
      mandatory: test.optional?.includes(ctx.version) ? false : true,
      testKey: test.testKey,
      documentationUrl: test.documentationUrl,
      errorMessage: error.message,
      log: ctx.log,
    };
  }
};
