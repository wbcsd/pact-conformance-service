import express from "express";
import config from "./config";
import logger, { loggerMiddleware } from "./utils/logger";
import { context } from "./middleware/context";
import { errorHandler } from "./middleware/error-handler";
import { db } from "./data";
import { ServiceContainer } from "./services";
import { PagingParameters, TestRunStartParams } from "./services/types";


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
  return await req.services.repository.getTestResultsWithPercentages(req.params.id);
}));

// Start a new test run
app.post("/testruns/", context(async (req) => {
  return req.services.worker.startTestRun(req.body as TestRunStartParams);
}));

// Authentication endpoint for callbacks
app.post("/auth/token", context(async (req) => {
  const authRequest = req.services.eventHandler.parseBasicAuth(req.headers.authorization);
  return await req.services.eventHandler.authenticate(authRequest);
}));

// Callback event listener for v3 events
app.post("/2/events", context(async (req) => {
  await req.services.eventHandler.processEvent(req.body, req.url);
  return undefined; // Return 200 OK with no body
}));

// Callback event listener for v3 events
app.post("/3/events", context(async (req) => {
   await req.services.eventHandler.processEvent(req.body, req.url);
   return undefined; // Return 200 OK with no body  
}));

// Error handling middleware (should be last)
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.info(`API Server is running on port ${port}`);
});
