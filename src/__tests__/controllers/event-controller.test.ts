import { Request, Response } from "express";
import { EventController } from "../../controllers/eventController";
import { mockFootprintsV2, mockFootprintsV3 } from "../mocks/footprints";
import { TestCaseResultStatus, EventTypesV2, EventTypesV3, TestStorage } from "../../services/types";

describe("EventController listening for async requests", () => {
  
  let controller: EventController;
  let mockDb: jest.Mocked<TestStorage>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  // Setup before each test
  beforeEach(() => {

    jest.clearAllMocks();

    // Create a mocked TestRunRepository
    mockDb = {
      saveTestRun: jest.fn(),
      updateTestRunStatus: jest.fn(),
      saveTestCaseResult: jest.fn(),
      saveTestCaseResults: jest.fn(),
      getTestResults: jest.fn(),
      saveTestData: jest.fn(),
      getTestData: jest.fn(),
      listTestRuns: jest.fn(),
      searchTestRuns: jest.fn(),
    } as jest.Mocked<TestStorage>;

    mockRequest = {
      query: {},
      params: {},
      body: {},
      app: {
        locals: {
          services: {
            repository: mockDb
          }
        }
      } as any
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    controller = new EventController();
  });

  test("should process valid fulfillment event and mark test as successful", async () => {
    // Mock test data that would be retrieved from DB
    const mockTestData = {
      version: "V2.3",
      productIds: ["urn:product-123", "urn:product-456"],
    };

    // Mock DB utility functions
    mockDb.getTestData.mockResolvedValue(mockTestData);
    mockDb.saveTestCaseResult.mockResolvedValue(undefined);

    const currentTime = new Date().toISOString();
    // Valid event fulfillment body that matches the schema requirements
    const validEventBody = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      specversion: "1.0",
      type: EventTypesV2.FULFILLED,
      source: "https://example.com",
      time: currentTime,
      data: {
        requestEventId: "request-12",
        pfs: [
          {
            ...mockFootprintsV2.data[0],
            productIds: mockTestData.productIds,
          },
        ],
      },
    };

    // Create the API Gateway event with V2 path
    mockRequest.url = "/2/events";
    mockRequest.body = validEventBody;

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Validate the response
    expect(mockResponse.status).toHaveBeenCalledWith(200);

    // Verify that getTestData was called correctly
    expect(mockDb.getTestData).toHaveBeenCalledWith("request");

    // Verify that saveTestCaseResult was called with the successful test result
    expect(mockDb.saveTestCaseResult).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({
        name: "Test Case 13: Respond to Asynchronous PCF Request",
        status: TestCaseResultStatus.SUCCESS,
        mandatory: true,
        testKey: "TESTCASE#13",
      }),
      true
    );
  });

  test("should process valid fulfillment event for V3.0 and mark test as successful", async () => {
    // Mock test data that would be retrieved from DB with V3.0 version
    const mockTestData = {
      version: "V3.0",
      productIds: ["urn:product-123", "urn:product-456"],
    };

    // Mock DB utility functions
    mockDb.getTestData.mockResolvedValue(mockTestData);
    mockDb.saveTestCaseResult.mockResolvedValue(undefined);

    const currentTime = new Date().toISOString();
    // Valid event fulfillment body for V3.0 that matches the schema requirements
    const validEventBody = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      specversion: "1.0",
      type: EventTypesV3.FULFILLED,
      source: "https://example.com",
      time: currentTime,
      data: {
        requestEventId: "request-12",
        pfs: [
          {
            ...mockFootprintsV3.data[0],
            productIds: mockTestData.productIds,
          },
        ],
      },
    };

    // Create the API Gateway event with V3 path
    mockRequest.url = "/3/events";
    mockRequest.body = validEventBody;

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Validate the response
    expect(mockResponse.status).toHaveBeenCalledWith(200);

    // Verify that getTestData was called correctly, without the trailing test case number
    expect(mockDb.getTestData).toHaveBeenCalledWith("request");

    // Verify that saveTestCaseResult was called with the successful test result
    expect(mockDb.saveTestCaseResult).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({
        name: "Test Case 13: Respond to Asynchronous PCF Request",
        status: TestCaseResultStatus.SUCCESS,
        mandatory: true,
        testKey: "TESTCASE#13",
      }),
      true
    );
  });

  test("should mark test as failure when product IDs do not match", async () => {
    // Mock test data with different product IDs than what's in the response
    const mockTestData = {
      version: "V2.3",
      productIds: ["urn:different-product-id"],
    };

    // Mock DB utility functions
    mockDb.getTestData.mockResolvedValue(mockTestData);
    mockDb.saveTestCaseResult.mockResolvedValue(undefined);

    // Valid event structure but with different product IDs
    const eventBody = {
      id: "event-id-1234",
      eventId: "event-id-1234",
      specversion: "1.0",
      type: EventTypesV2.FULFILLED,
      source: "https://example.com",
      time: new Date().toISOString(),
      data: {
        requestEventId: "request-12",
        pfs: [
          {
            id: "pf-id-123",
            specVersion: "2.3.0",
            version: "2.3.0",
            created: new Date().toISOString(),
            status: "active",
            comment: "Test comment",
            companyName: "Test Company",
            companyIds: [{ value: "company-123", type: "DUNS" }],
            productDescription: "Test Product",
            productCategoryCpc: "Test Category",
            productNameCompany: "Test Product Name",
            productIds: ["urn:product-123"], // Different from mockTestData
            pcf: {
              declaredUnit: "kg",
              unitaryProductAmount: 1,
              carbonFootprint: {
                value: 10,
              },
            },
            footprint: {
              id: "footprint-123",
              version: "2.3.0",
              status: "active",
              companyName: "Test Company",
              companyIds: [{ value: "company-123", type: "DUNS" }],
              productDescription: "Test Product",
            },
          },
        ],
      },
    };

    // Create the API Gateway event with V2 path
    mockRequest.url = "/2/events";
    mockRequest.body = eventBody;

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Verify response
    expect(mockResponse.status).toHaveBeenCalledWith(200);

    // Verify that saveTestCaseResult was called with a failure result
    expect(mockDb.saveTestCaseResult).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({
        name: "Test Case 13: Respond to Asynchronous PCF Request",
        status: TestCaseResultStatus.FAILURE,
        mandatory: true,
        testKey: "TESTCASE#13",
        errorMessage: expect.stringContaining("Product IDs do not match"),
      }),
      true
    );
  });

  test("should mark test as failure when event validation fails", async () => {
    // Mock test data
    const mockTestData = {
      version: "V2.3",
      productIds: ["urn:product-123"],
    };

    // Mock DB utility functions
    mockDb.getTestData.mockResolvedValue(mockTestData);
    mockDb.saveTestCaseResult.mockResolvedValue(undefined);

    // Invalid event body (missing required fields but with enough structure to process)
    const invalidEventBody = {
      id: "event-id-1234",
      eventId: "event-id-1234",
      // Missing specversion
      type: EventTypesV2.FULFILLED,
      source: "https://example.com",
      data: {
        requestEventId: "request-12",
        pfs: [
          {
            // Missing most required fields
            productIds: ["urn:product-123"],
          },
        ],
      },
    };

    // Create the API Gateway event with V2 path
    mockRequest.url = "/2/events";
    mockRequest.body = invalidEventBody;

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Verify response
    expect(mockResponse.status).toHaveBeenCalledWith(200);

    // Verify that saveTestCaseResult was called with a failure result due to validation
    expect(mockDb.saveTestCaseResult).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({
        name: "Test Case 13: Respond to Asynchronous PCF Request",
        status: "FAILURE",
        mandatory: true,
        testKey: "TESTCASE#13",
        errorMessage: expect.stringContaining("Event validation failed"),
      }),
      true
    );
  });

  test("should return 400 status code when body is missing", async () => {
    // Create event with no body
    mockRequest.url = "/2/events";

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Verify response is 400 because the event is malformed.
    expect(mockResponse.status).toHaveBeenCalledWith(400);

    // Verify that getTestData was not called
    expect(mockDb.getTestData).not.toHaveBeenCalled();
    expect(mockDb.saveTestCaseResult).not.toHaveBeenCalled();
  });

  test("should return 400 status code when it's immediately clear test data cannot be found", async () => {
    // Create event with body but no testRunId
    mockDb.getTestData.mockResolvedValue(null);

    mockRequest.url = "/2/events";
    mockRequest.body = {
      data: { requestEventId: "123" },
    };

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Verify response is 400
    expect(mockResponse.status).toHaveBeenCalledWith(400);

    expect(mockDb.getTestData).toHaveBeenCalled();
    expect(mockDb.saveTestCaseResult).not.toHaveBeenCalled();
  });

  test("should handle errors gracefully and return 400", async () => {
    // Mock DB utility function to throw an error
    mockDb.getTestData.mockRejectedValue(
      new Error("Database error")
    );

    // Valid event body
    const eventBody = {
      eventId: "event-id-1234",
      specversion: "1.0",
      type: EventTypesV2.FULFILLED,
      source: "https://example.com",
      time: new Date().toISOString(),
      data: {
        requestEventId: "request-123",
        pfs: [
          {
            productIds: ["product-123"],
            footprint: {
              id: "footprint-123",
              version: "2.3.0",
            },
          },
        ],
      },
    };

    // Create the request
    mockRequest.url = "/2/events";
    mockRequest.body = eventBody;

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
  });

  test("should do nothing when the event type is not Fulfilled or Rejected", async () => {
    // Mock test data that would be retrieved from DB
    const mockTestData = {
      version: "V2.3",
      productIds: ["urn:product-123", "urn:product-456"],
    };

    // Mock DB utility functions
    mockDb.getTestData.mockResolvedValue(mockTestData);

    // Valid event body
    const eventBody = {
      eventId: "event-id-1234",
      specversion: "1.0",
      type: EventTypesV2.CREATED,
      source: "https://example.com",
      time: new Date().toISOString(),
      data: {
        requestEventId: "request-123",
        pfs: [
          {
            productIds: ["product-123"],
            footprint: { id: "footprint-123" },
          },
        ],
      },
    };

    // Create the request (default for event type Created.v1)
    mockRequest.url = "/2/events";
    mockRequest.body = eventBody;

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Verify response is 200
    expect(mockResponse.status).toHaveBeenCalledWith(200);

    // Verify that DB functions were not called
    expect(mockDb.saveTestCaseResult).not.toHaveBeenCalled();
  });

  test("should mark test as failure when V2 event uses wrong path", async () => {
    // Mock test data
    const mockTestData = {
      version: "V2.3",
      productIds: ["urn:product-123"],
    };

    // Mock DB utility functions
    mockDb.getTestData.mockResolvedValue(mockTestData);
    mockDb.saveTestCaseResult.mockResolvedValue(undefined);

    const currentTime = new Date().toISOString();
    // Valid event body for V2 but using wrong path
    const validEventBody = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      specversion: "1.0",
      type: EventTypesV2.FULFILLED,
      source: "https://example.com",
      time: currentTime,
      data: {
        requestEventId: "request-12",
        pfs: [
          {
            ...mockFootprintsV2.data[0],
            productIds: mockTestData.productIds,
          },
        ],
      },
    };

    // Create the request with wrong path (V3 path for V2 event)
    mockRequest.url = "/3/events";
    mockRequest.body = validEventBody;

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Validate the response
    expect(mockResponse.status).toHaveBeenCalledWith(200);

    // Verify that saveTestCaseResult was called with a failure result due to path validation
    expect(mockDb.saveTestCaseResult).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({
        name: "Test Case 13: Respond to Asynchronous PCF Request",
        status: TestCaseResultStatus.FAILURE,
        mandatory: true,
        testKey: "TESTCASE#13",
        errorMessage: expect.stringContaining(
          "Invalid request path: expected /2/events, but received /3/events"
        ),
      }),
      true
    );
  });

  test("should mark test as failure when V3 event uses wrong path", async () => {
    // Mock test data
    const mockTestData = {
      version: "V3.0",
      productIds: ["urn:product-123"],
    };

    // Mock DB utility functions
    mockDb.getTestData.mockResolvedValue(mockTestData);
    mockDb.saveTestCaseResult.mockResolvedValue(undefined);

    const currentTime = new Date().toISOString();
    // Valid event body for V3 but using wrong path
    const validEventBody = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      specversion: "1.0",
      type: EventTypesV3.FULFILLED,
      source: "https://example.com",
      time: currentTime,
      data: {
        requestEventId: "request-12",
        pfs: [
          {
            ...mockFootprintsV3.data[0],
            productIds: mockTestData.productIds,
          },
        ],
      },
    };

    // Create the request with wrong path (V2 path for V3 event)
    mockRequest.url = "/2/events";
    mockRequest.body = validEventBody;

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Validate the response
    expect(mockResponse.status).toHaveBeenCalledWith(200);

    // Verify that saveTestCaseResult was called with a failure result due to path validation
    expect(mockDb.saveTestCaseResult).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({
        name: "Test Case 13: Respond to Asynchronous PCF Request",
        status: TestCaseResultStatus.FAILURE,
        mandatory: true,
        testKey: "TESTCASE#13",
        errorMessage: expect.stringContaining(
          "Invalid request path: expected /3/events, but received /2/events"
        ),
      }),
      true
    );
  });

  test("should mark test as failure when both event validation and path validation fail", async () => {
    // Mock test data
    const mockTestData = {
      version: "V2.3",
      productIds: ["urn:product-123"],
    };

    // Mock DB utility functions
    mockDb.getTestData.mockResolvedValue(mockTestData);
    mockDb.saveTestCaseResult.mockResolvedValue(undefined);

    // Invalid event body (missing required fields) with wrong path
    const invalidEventBody = {
      id: "event-id-1234",
      eventId: "event-id-1234",
      // Missing specversion
      type: "org.wbcsd.pathfinder.ProductFootprintRequest.Fulfilled.v1",
      source: "https://example.com",
      data: {
        requestEventId: "request-12",
        pfs: [
          {
            // Missing most required fields
            productIds: ["urn:product-123"],
          },
        ],
      },
    };

    // Create the request with wrong path
    mockRequest.url = "/3/events";
    mockRequest.body = invalidEventBody;

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Verify response
    expect(mockResponse.status).toHaveBeenCalledWith(200);

    // Verify that saveTestCaseResult was called with a failure result containing both errors
    expect(mockDb.saveTestCaseResult).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({
        name: "Test Case 13: Respond to Asynchronous PCF Request",
        status: "FAILURE",
        mandatory: true,
        testKey: "TESTCASE#13",
        errorMessage: expect.stringMatching(
          /Event validation failed.*Invalid request path/
        ),
      }),
      true
    );
  });
});
