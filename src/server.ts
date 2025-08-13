import express from "express";
import { APIGatewayProxyEvent,APIGatewayProxyResult } from "aws-lambda";
import config from "./config";
import { 
    runTestCasesHandler,
    asyncRequestListenerHandler,
    getTestResultsHandler,
    authForAsyncListenerHandler,
    getRecentTestRunsHandler   
    } from ".";

// Create Express app
const app = express();
const port = config.port;

// Middleware for parsing JSON bodies
app.use(express.json());

// Wrapper for AWS Lambda event to Express request
const wrapper = (func: any) => {
    return async (req: any, res: any) => {
        try {
            console.log(`Received request: ${req.method} ${req.url}`);
            // Create a mock APIGatewayProxyEvent from the Express request
            const event: APIGatewayProxyEvent = {
                body: JSON.stringify(req.body),
                headers: req.headers as { [key: string]: string },
                httpMethod: req.method,
                requestContext: { http: { path: req.url, httpMethod: req.method } } as any,
                queryStringParameters: req.query as { [key: string]: string }
            } as APIGatewayProxyEvent;

            // Call the Lambda handler function
            const result: APIGatewayProxyResult = await func(event);

            // Send the response back to the client
            if (result.body)
                res.status(result.statusCode).send(JSON.parse(result.body));
            else
                res.status(result.statusCode).send();
        } catch (error) {
            console.error('Error:', error);
            res.status(500).send({ message: 'Internal Server Error' });
        }
    };
};

// Define routes

// Invoke test cases
app.post('/runTestCases', wrapper(runTestCasesHandler))
app.get('/getTestResults', wrapper(getTestResultsHandler));
app.get('/getRecentTestRuns', wrapper(getRecentTestRunsHandler));

// Call back listeners
app.post('/2/events', wrapper(asyncRequestListenerHandler));
app.post('/3/events', wrapper(asyncRequestListenerHandler));
app.post('/auth/token', wrapper(authForAsyncListenerHandler));


// Start server
app.listen(port, () => {
  console.log(`API Server is running on port ${port}`);
});
