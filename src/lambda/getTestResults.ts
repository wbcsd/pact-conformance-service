import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getTestResults } from "../utils/dbUtils";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const testRunId = event.queryStringParameters?.testRunId;

    if (!testRunId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Missing required query parameter: testRunId",
        }),
      };
    }

    const result = await getTestResults(testRunId);
    if (!result) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Test run with ID ${testRunId} not found`,
        }),
      };
    }

    // Calculate passing percentage
    const mandatoryTests = result.results.filter((test) => test.mandatory);
    const failedMandatoryTests = mandatoryTests.filter((test) => !test.success);

    const passingPercentage =
      mandatoryTests.length > 0
        ? Math.round(
            ((mandatoryTests.length - failedMandatoryTests.length) /
              mandatoryTests.length) *
              100
          )
        : 0;

    // Calculate non-mandatory passing percentage
    const nonMandatoryTests = result.results.filter((test) => !test.mandatory);
    const failedNonMandatoryTests = nonMandatoryTests.filter(
      (test) => !test.success
    );
    const nonMandatoryPassingPercentage =
      nonMandatoryTests.length > 0
        ? Math.round(
            ((nonMandatoryTests.length - failedNonMandatoryTests.length) /
              nonMandatoryTests.length) *
              100
          )
        : 0;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...result,
        passingPercentage,
        nonMandatoryPassingPercentage,
      }),
    };
  } catch (error) {
    console.error("Error retrieving test results:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      }),
    };
  }
};
