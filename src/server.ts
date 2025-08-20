import express from "express";
import pino from "pino-http";
import logger from "./utils/logger";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import config from "./config";
import {
  runTestCasesHandler,
  asyncRequestListenerHandler,
  getTestResultsHandler,
  authForAsyncListenerHandler,
  getRecentTestRunsHandler,
} from ".";

// Create Express app
const app = express();
const port = config.port;

// Middleware for parsing JSON bodies
app.use(express.json());

// Pino logging middleware
app.use(
  pino({
    logger,
    name: process.env.SERVICE_NAME,
    // Log debug information for anything lower than production
    level: process.env.NODE_ENV === "prod" ? "info" : "debug",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
      },
    },
  })
);

// Wrapper for AWS Lambda event to Express request
const wrapper = (func: any) => {
  return async (req: any, res: any) => {
    try {
      logger.info(`Received request: ${req.method} ${req.url}`);
      // Create a mock APIGatewayProxyEvent from the Express request
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify(req.body),
        headers: req.headers as { [key: string]: string },
        httpMethod: req.method,
        requestContext: {
          http: { path: req.url, httpMethod: req.method },
        } as any,
        queryStringParameters: req.query as { [key: string]: string },
      } as APIGatewayProxyEvent;

      // Call the Lambda handler function
      const result: APIGatewayProxyResult = await func(event);

      // Send the response back to the client
      if (result.body)
        res.status(result.statusCode).send(JSON.parse(result.body));
      else res.status(result.statusCode).send();
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send({ message: "Internal Server Error" });
    }
  };
};

// Define health check route
app.get("/health-check", (_, res) => {
  res.status(200).send({
    status: "OK",
    service: process.env.SERVICE_NAME,
    git_commit: process.env.RENDER_GIT_COMMIT || "N/A",
    render_service_name: process.env.RENDER_SERVICE_NAME || "N/A",
    render_service_type: process.env.RENDER_SERVICE_TYPE || "N/A",
  });
});

// Define routes

// Invoke test cases
app.post("/runTestCases", wrapper(runTestCasesHandler));
app.get("/getTestResults", wrapper(getTestResultsHandler));
app.get("/getRecentTestRuns", wrapper(getRecentTestRunsHandler));

// Call back listeners
app.post("/2/events", wrapper(asyncRequestListenerHandler));
app.post("/3/events", wrapper(asyncRequestListenerHandler));
app.post("/auth/token", wrapper(authForAsyncListenerHandler));

// Start server
app.listen(port, () => {
  logger.info(`API Server is running on port ${port}`);
});
