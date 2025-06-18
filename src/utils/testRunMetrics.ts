import { TestResult, TestRunStatus } from "../types/types";

/**
 * Recalculates test run status and passing percentage from test results
 * @param testResults Array of test results to analyze
 * @returns Object containing test run status, passing percentage, and failed mandatory tests
 */
export const calculateTestRunMetrics = (testResults: TestResult[]) => {
  const mandatoryTests = testResults.filter((result) => result.mandatory);
  const failedMandatoryTests = mandatoryTests.filter(
    (result) => !result.success
  );

  const passingPercentage =
    mandatoryTests.length > 0
      ? Math.round(
          ((mandatoryTests.length - failedMandatoryTests.length) /
            mandatoryTests.length) *
            100
        )
      : 0;

  const testRunStatus =
    failedMandatoryTests.length > 0 ? TestRunStatus.FAIL : TestRunStatus.PASS;

  return { testRunStatus, passingPercentage, failedMandatoryTests };
};
