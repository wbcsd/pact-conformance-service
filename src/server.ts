import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import logger, { loggerMiddleware } from "./utils/logger";
import {
  getTestRuns,
  getTestRunById,
  createTestRun,
  searchOrGetTestRuns,
} from "./controllers/testRunController";
import { handleEvent, authToken } from "./controllers/eventController";

// Create Express app
const app = express();
const port = process.env.PORT || 8080;

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

// Define routes

// Create test run related routes
app.get("/testruns/", searchOrGetTestRuns);
app.get("/testruns/:id", getTestRunById);
app.post("/testruns/", createTestRun);

// Backwards compatible endpoints
app.get("/getRecentTestRuns", getTestRuns);
app.get("/getTestResults", getTestRunById);
app.post("/runTestCases", createTestRun);

// Call back listeners
app.post("/2/events", handleEvent);
app.post("/3/events", handleEvent);
app.post("/auth/token", authToken);

// Start server
app.listen(port, () => {
  logger.info(`API Server is running on port ${port}`);
});
