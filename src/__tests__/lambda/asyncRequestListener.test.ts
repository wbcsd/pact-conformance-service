import { Request, Response } from "express";
import { EventController } from "../../controllers/eventController";

import * as dbUtils from "../../utils/dbUtils";
import { mockFootprints, mockFootprintsV3 } from "../mocks/footprints";
import { TestCaseResultStatus, EventTypesV2, EventTypesV3 } from "../../types/types";

// Mock the DB utils
jest.mock("../../utils/dbUtils");

describe("asyncRequestListener Lambda handler", () => {
  
  let controller: EventController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  // Setup before each test
  beforeEach(() => {

    jest.clearAllMocks();

    mockRequest = {
      query: {},
      params: {},
      body: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
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
    (dbUtils.getTestData as jest.Mock).mockResolvedValue(mockTestData);
    (dbUtils.saveTestCaseResult as jest.Mock).mockResolvedValue(undefined);

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
        requestEventId: "request-123",
        pfs: [
          {
            ...mockFootprints.data[0],
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
    expect(dbUtils.getTestData).toHaveBeenCalledWith("request-123");

    // Verify that saveTestCaseResult was called with the successful test result
    expect(dbUtils.saveTestCaseResult).toHaveBeenCalledWith(
      "request-123",
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
    (dbUtils.getTestData as jest.Mock).mockResolvedValue(mockTestData);
    (dbUtils.saveTestCaseResult as jest.Mock).mockResolvedValue(undefined);

    const currentTime = new Date().toISOString();
    // Valid event fulfillment body for V3.0 that matches the schema requirements
    const validEventBody = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      specversion: "1.0",
      type: EventTypesV2.FULFILLED,
      source: "https://example.com",
      time: currentTime,
      data: {
        requestEventId: "request-123",
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

    // Verify that getTestData was called correctly
    expect(dbUtils.getTestData).toHaveBeenCalledWith("request-123");

    // Verify that saveTestCaseResult was called with the successful test result
    expect(dbUtils.saveTestCaseResult).toHaveBeenCalledWith(
      "request-123",
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
    (dbUtils.getTestData as jest.Mock).mockResolvedValue(mockTestData);
    (dbUtils.saveTestCaseResult as jest.Mock).mockResolvedValue(undefined);

    // Valid event structure but with different product IDs
    const eventBody = {
      id: "event-id-1234",
      eventId: "event-id-1234",
      specversion: "1.0",
      type: EventTypesV2.FULFILLED,
      source: "https://example.com",
      time: new Date().toISOString(),
      data: {
        requestEventId: "request-123",
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
    expect(dbUtils.saveTestCaseResult).toHaveBeenCalledWith(
      "request-123",
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
    (dbUtils.getTestData as jest.Mock).mockResolvedValue(mockTestData);
    (dbUtils.saveTestCaseResult as jest.Mock).mockResolvedValue(undefined);

    // Invalid event body (missing required fields but with enough structure to process)
    const invalidEventBody = {
      id: "event-id-1234",
      eventId: "event-id-1234",
      // Missing specversion
      type: EventTypesV2.FULFILLED,
      source: "https://example.com",
      data: {
        requestEventId: "request-123",
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
    expect(dbUtils.saveTestCaseResult).toHaveBeenCalledWith(
      "request-123",
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
    expect(dbUtils.getTestData).not.toHaveBeenCalled();
    expect(dbUtils.saveTestCaseResult).not.toHaveBeenCalled();
  });

  test("should return 400 status code when it's immediately clear test data cannot be found", async () => {
    // Create event with body but no testRunId
    (dbUtils.getTestData as jest.Mock).mockResolvedValue(null);

    mockRequest.url = "/2/events";
    mockRequest.body = {
      data: { requestEventId: "123" },
    };

    // Call the handler
    await controller.handleEvent(mockRequest as Request, mockResponse as Response);

    // Verify response is 400
    expect(mockResponse.status).toHaveBeenCalledWith(400);

    expect(dbUtils.getTestData).toHaveBeenCalled();
    expect(dbUtils.saveTestCaseResult).not.toHaveBeenCalled();
  });

  test("should handle errors gracefully and return 400", async () => {
    // Mock DB utility function to throw an error
    (dbUtils.getTestData as jest.Mock).mockRejectedValue(
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
    (dbUtils.getTestData as jest.Mock).mockResolvedValue(mockTestData);

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
    expect(dbUtils.saveTestCaseResult).not.toHaveBeenCalled();
  });

  test("should mark test as failure when V2 event uses wrong path", async () => {
    // Mock test data
    const mockTestData = {
      version: "V2.3",
      productIds: ["urn:product-123"],
    };

    // Mock DB utility functions
    (dbUtils.getTestData as jest.Mock).mockResolvedValue(mockTestData);
    (dbUtils.saveTestCaseResult as jest.Mock).mockResolvedValue(undefined);

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
        requestEventId: "request-123",
        pfs: [
          {
            ...mockFootprints.data[0],
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
    expect(dbUtils.saveTestCaseResult).toHaveBeenCalledWith(
      "request-123",
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
    (dbUtils.getTestData as jest.Mock).mockResolvedValue(mockTestData);
    (dbUtils.saveTestCaseResult as jest.Mock).mockResolvedValue(undefined);

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
        requestEventId: "request-123",
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
    expect(dbUtils.saveTestCaseResult).toHaveBeenCalledWith(
      "request-123",
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
    (dbUtils.getTestData as jest.Mock).mockResolvedValue(mockTestData);
    (dbUtils.saveTestCaseResult as jest.Mock).mockResolvedValue(undefined);

    // Invalid event body (missing required fields) with wrong path
    const invalidEventBody = {
      id: "event-id-1234",
      eventId: "event-id-1234",
      // Missing specversion
      type: "org.wbcsd.pathfinder.ProductFootprintRequest.Fulfilled.v1",
      source: "https://example.com",
      data: {
        requestEventId: "request-123",
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
    expect(dbUtils.saveTestCaseResult).toHaveBeenCalledWith(
      "request-123",
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
     