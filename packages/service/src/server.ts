import { randomBytes } from "crypto";
import express from "express";
import config from "./config";
import logger, { loggerMiddleware } from "./logger";
import { context } from "./middleware/context";
import { errorHandler } from "./middleware/error-handler";
import { db } from "./data";
import { ServiceContainer } from "./services";
import { PagingParameters, TestRunStartParams } from "pact-conformance-test";


// Create Express app
const app = express();
const port = config.PORT || 8080;

// Initialize service container
const services = new ServiceContainer(db);

// Make services available to routes via app.locals
app.locals.services = services;

// Middleware for parsing JSON bodies
app.use(express.json({type: ["application/json", "application/cloudevents+json"]}));

// Logging middleware
app.use(loggerMiddleware);

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

// List test runs
app.get("/testruns", context(async (req) => {
  const testRuns = await req.services.repository.listTestRuns(
    req.query as PagingParameters,
    req.query.adminEmail as string
  );
  return {
    testRuns,
    count: testRuns.length
   }
}));

// Get a test run
app.get("/testruns/:id", context(async (req) => {
  return await req.services.repository.getTestRunWithResults(req.params.id as string);
}));

// Start a new test run
app.post("/testruns/", context(async (req) => {
  try {
    const params = { ...req.body, adminEmail: "-old-implementation-" } as TestRunStartParams;
    await req.services.workerOld.startTestRun(params);
  } catch (err) {
    logger.error("Error starting test run with old worker", { error: err });
  }
  return await req.services.worker.startTestRun(req.body as TestRunStartParams);
}));

// Stub auth endpoint for tested APIs that call back to us. The token is opaque to
// us (handleCallback does not validate it), so we only need to satisfy the spec's
// OAuth2 client-credentials response shape.
app.post("/auth/token", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.status(401).json({ code: "Unauthorized", message: "Missing or invalid Basic Authorization header" });
    return;
  }
  res.json({ access_token: randomBytes(24).toString("hex"), token_type: "Bearer", expires_in: 3600 });
});

// Callback event listener for both v2 and v3 events
app.post(["/2/events", "/3/events"], context(async (req) => {
  await req.services.worker.handleCallback(req);
  return undefined; // Return 200 OK with no body
}));

// Error handling middleware (should be last)
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.info(`API Server is running on port ${port}`);
});
