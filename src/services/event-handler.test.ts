import { jest } from "@jest/globals";
import { EventHandler } from "./event-handler";
import { EventTypesV2, EventTypesV3, TestCaseResultStatus } from "./types";
import * as jwt from "jsonwebtoken";
import { BadRequestError, UnauthorizedError, NotFoundError } from "../errors";

// Mock jwt module at the top level
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
}));

// Helper to create mock test run data
const createMockTestRun = (version: string, productIds: string[]) => ({
  testRunId: "run123",
  organizationName: "Test Org",
  adminEmail: "test@test.com",
  adminName: "Test Admin",
  timestamp: "2024-01-01T00:00:00Z",
  status: "PENDING",
  techSpecVersion: version,
  data: { productIds },
  results: [],
});

describe("EventHandler", () => {
  let storageMock: any;
  let handler: EventHandler;

  beforeEach(() => {
    storageMock = {
      saveTestCaseResults: jest.fn(),
      getTestResults: jest.fn(),
      getTestRun: jest.fn(),
      getTestRunWithResults: jest.fn(),
      updateTestRunStatus: jest.fn(),
    };
    handler = new EventHandler(storageMock);
    jest.restoreAllMocks();
  });

  describe("authenticate", () => {
    test("throws BadRequestError when credentials missing", async () => {
      await expect(
        (handler as any).authenticate({ clientId: "", clientSecret: "" })
      ).rejects.toThrow(BadRequestError);

      await expect(
        (handler as any).authenticate({ clientId: undefined as any, clientSecret: "x" })
      ).rejects.toThrow(BadRequestError);
    });

    test("throws UnauthorizedError when credentials invalid", async () => {
      await expect(
        (handler as any).authenticate({ clientId: "bad", clientSecret: "bad" })
      ).rejects.toThrow(UnauthorizedError);
    });

    test("returns token when credentials valid", async () => {
      const signSpy = jest.spyOn(jwt, "sign").mockReturnValue("signed-token" as any);
      const res = await (handler as any).authenticate({
        clientId: "test_client_id",
        clientSecret: "test_client_secret",
      });
      expect(signSpy).toHaveBeenCalled();
      expect(res).toHaveProperty("access_token", "signed-token");
    });
  });

  describe("parseBasicAuth", () => {
    test("throws when header missing or invalid", () => {
      expect(() => handler.parseBasicAuth()).toThrow(BadRequestError);
      expect(() => handler.parseBasicAuth("Bearer token")).toThrow(BadRequestError);
    });

    test("throws when credentials format invalid", () => {
      const bad = "Basic " + Buffer.from("onlyclient").toString("base64");
      expect(() => handler.parseBasicAuth(bad)).toThrow(BadRequestError);
    });

    test("parses valid header", () => {
      const header = "Basic " + Buffer.from("clientId:clientSecret").toString("base64");
      const creds = handler.parseBasicAuth(header);
      expect(creds).toEqual({ clientId: "clientId", clientSecret: "clientSecret" });
    });
  });

  describe("processEvent", () => {
    test("throws BadRequestError when event payload missing or missing requestEventId", async () => {
      await expect((handler as any).processEvent(undefined, "/2/events")).rejects.toThrow(
        BadRequestError
      );

      const payloadNoId = { type: EventTypesV2.FULFILLED, data: {} };
      await expect((handler as any).processEvent(payloadNoId, "/2/events")).rejects.toThrow(
        BadRequestError
      );
    });

    test("throws NotFoundError when test run not found", async () => {
      storageMock.getTestRun.mockRejectedValue(new NotFoundError("Test run not found"));
      const payload = { type: EventTypesV2.FULFILLED, data: { requestEventId: "run123-abc" } };
      await expect((handler as any).processEvent(payload, "/2/events")).rejects.toThrow(
        NotFoundError
      );
      expect(storageMock.getTestRun).toHaveBeenCalledWith("run123");
    });

    test("extracts test run ID from requestEventId by splitting on first dash", async () => {
      storageMock.getTestRun.mockRejectedValue(new NotFoundError("Test run not found"));
      const payload = { type: EventTypesV2.FULFILLED, data: { requestEventId: "run123-abc-def" } };
      await expect((handler as any).processEvent(payload, "/2/events")).rejects.toThrow(
        NotFoundError
      );
      expect(storageMock.getTestRun).toHaveBeenCalledWith("run123");
    });

    test("delegates to processFulfilledEvent for FULFILLED events", async () => {
      const testRun = createMockTestRun("V2.2", ["p1"]);
      storageMock.getTestRun.mockResolvedValue(testRun);
      const spy = jest
        .spyOn(EventHandler.prototype as any, "processFulfilledEvent")
        .mockResolvedValue(undefined);

      const payload = { type: EventTypesV2.FULFILLED, data: { requestEventId: "run123-abc" } };
      await (handler as any).processEvent(payload, "/2/events");

      expect(spy).toHaveBeenCalledWith(payload, "run123", testRun, "/2/events");
    });

    test("processes REJECTED event and saves success result when valid", async () => {
      const testRun = createMockTestRun("V2.2", ["p1"]);
      storageMock.getTestRun.mockResolvedValue(testRun);
      const payload = {
        type: EventTypesV2.REJECTED,
        data: { requestEventId: "run123-abc", error: { code: "ERR", message: "failed" } },
      };

      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalled();
      const [savedTestRunId, savedResults] = storageMock.saveTestCaseResults.mock.calls[0];
      expect(savedTestRunId).toBe("run123");
      expect(savedResults).toHaveLength(1);
      expect(savedResults[0]).toEqual(
        expect.objectContaining({
          testKey: "TESTCASE#14.B",
          status: TestCaseResultStatus.SUCCESS,
        })
      );
    });

    test("uses full requestEventId when no dash is present", async () => {
      const testRun = createMockTestRun("V2.2", ["p1"]);
      storageMock.getTestRun.mockResolvedValue(testRun);

      const payload = { type: EventTypesV2.REJECTED, data: { requestEventId: "run123", error: { code: "ERR", message: "x" } } };
      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.getTestRun).toHaveBeenCalledWith("run123");
    });

    test("ignores unsupported event types", async () => {
      const testRun = createMockTestRun("V2.2", ["p1"]);
      storageMock.getTestRun.mockResolvedValue(testRun);

      const payload = { type: "UNKNOWN_EVENT", data: { requestEventId: "run123-abc" } };
      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.saveTestCaseResults).not.toHaveBeenCalled();
      expect(storageMock.updateTestRunStatus).not.toHaveBeenCalled();
    });
  });

  describe("processFulfilledEvent (via processEvent)", () => {
    const baseTestRun = createMockTestRun("V2.2", ["urn:product1", "urn:product2"]);

    beforeEach(() => {
      storageMock.getTestRun.mockResolvedValue(baseTestRun);
    });

    test("saves success result for valid V2 fulfilled event with correct path", async () => {
      const payload = {
        type: EventTypesV2.FULFILLED,
        specversion: "1.0",
        id: "event-xyz",
        time: "2024-01-01T00:00:00Z",
        source: "urn:pact-conformance-service",
        data: {
          requestEventId: "run123-abc",
          pfs: [{
              productIds: ["urn:product1"],
              id: "b1f8c0d2-7c4e-4e67-9a9c-2e4c12345678",
              productDescription: "Test Product",
              productNameCompany: "Test Product",
              specVersion: "2.2.0",
              companyName: "Test Company",
              created: "2024-01-01T00:00:00Z",
              status: "Active",
              version: 1,
              companyIds: ["urn:comp-12345"],
              comment: "Comment",
              productCategoryCpc: "1234",
              pcf: {
                declaredUnit: "liter",
                unitaryProductAmount: "1",
                pCfExcludingBiogenic: "0.5",
                referencePeriodStart: "2024-01-01T00:00:00Z",
                referencePeriodEnd: "2025-01-01T00:00:00Z",
                fossilGhgEmissions: "0.4",
                biogenicCarbonContent: "0.1",
                fossilCarbonContent: "0.3",
                characterizationFactors: "AR6",
                ipccCharacterizationFactorsSources: ["AR6"],
                crossSectoralStandardsUsed: ["GHG Protocol Product standard", "ISO Standard 14067"],
                boundaryProcessesDescription: "Description of boundary processes",
                exemptedEmissionsPercent: 0,
                exemptedEmissionsDescription: "Description of exempted emissions",
                packagingEmissionsIncluded: true,
              },
            },
          ],
        },
      };

      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            name: "Test Case 13: Respond to Asynchronous PCF Request",
            status: TestCaseResultStatus.SUCCESS,
            testKey: "TESTCASE#13",
            mandatory: true,
            documentationUrl: expect.stringContaining("v2-test-cases"),
          }),
        ],
        true
      );
    });

    test("saves success result for valid V3 fulfilled event with correct path", async () => {
      const v3TestRun = createMockTestRun("V3.0", ["urn:product1"]);
      storageMock.getTestRun.mockResolvedValue(v3TestRun);

      const payload = {
        type: EventTypesV3.FULFILLED,
        specversion: "1.0",
        id: "event-xyz",
        time: "2024-01-01T00:00:00Z",
        source: "http://pact-conformance-service",
        data: {
          requestEventId: "run123-abc",
          pfs: [{
              productIds: ["urn:product1"],
              id: "b1f8c0d2-7c4e-4e67-9a9c-2e4c12345678",
              productDescription: "Test Product",
              productNameCompany: "Test Product",
              specVersion: "3.0.0",
              companyName: "Test Company",
              created: "2024-01-01T00:00:00Z",
              status: "Active",
              version: 1,
              companyIds: ["urn:comp-12345"],
              pcf: {
                declaredUnitOfMeasurement: "liter",
                declaredUnitAmount: "1",
                productMassPerDeclaredUnit: "1",
                pcfExcludingBiogenicUptake: "0.5",
                pcfIncludingBiogenicUptake: "0.5",
                referencePeriodStart: "2024-01-01T00:00:00Z",
                referencePeriodEnd: "2025-01-01T00:00:00Z",
                fossilGhgEmissions: "0.4",
                biogenicCarbonContent: "0.1",
                fossilCarbonContent: "0.3",
                characterizationFactors: "AR6",
                ipccCharacterizationFactors: ["AR6"],
                crossSectoralStandards: ["PACT-3.0"],
                boundaryProcessesDescription: "Description of boundary processes",
                exemptedEmissionsPercent: "0",
                exemptedEmissionsDescription: "Description of exempted emissions",
                packagingEmissionsIncluded: true,
              },
            },
          ],
        },
      };

      await (handler as any).processEvent(payload, "/3/events");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            status: TestCaseResultStatus.SUCCESS,
            testKey: "TESTCASE#13",
            documentationUrl: expect.stringContaining("v3-test-cases"),
          }),
        ],
        true
      );
    });

    test("saves failure result when request path is incorrect", async () => {
      const payload = {
        type: EventTypesV2.FULFILLED,
        data: {
          requestEventId: "run123-abc",
          pfs: [{ productIds: ["product1"] }],
        },
      };

      await (handler as any).processEvent(payload, "/wrong/path");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            status: TestCaseResultStatus.FAILURE,
            errorMessage: expect.stringContaining(
              "Invalid request path: expected /2/events, but received /wrong/path"
            ),
          }),
        ],
        true
      );
    });

    test("saves failure result when product IDs don't match", async () => {
      const payload = {
        type: EventTypesV2.FULFILLED,
        specversion: "1.0",
        id: "event-xyz",
        time: "2024-01-01T00:00:00Z",
        source: "https://pact-conformance-service",
        data: {
          requestEventId: "run123-abc",
          pfs: [
            {
              productIds: ["urn:wrongProduct"],
              id: "b1f8c0d2-7c4e-4e67-9a9c-2e4c12345678",
              productDescription: "Test Product",
              productNameCompany: "Test Product",
              specVersion: "2.2.0",
              companyName: "Test Company",
              created: "2024-01-01T00:00:00Z",
              status: "Active",
              version: 1,
              companyIds: ["urn:comp-12345"],
              comment: "Comment",
              productCategoryCpc: "1234",
              pcf: {
                declaredUnit: "liter",
                unitaryProductAmount: "1",
                pCfExcludingBiogenic: "0.5",
                referencePeriodStart: "2024-01-01T00:00:00Z",
                referencePeriodEnd: "2025-01-01T00:00:00Z",
                fossilGhgEmissions: "0.4",
                biogenicCarbonContent: "0.1",
                fossilCarbonContent: "0.3",
                characterizationFactors: "AR6",
                ipccCharacterizationFactorsSources: ["AR6"],
                crossSectoralStandardsUsed: ["GHG Protocol Product standard", "ISO Standard 14067"],
                boundaryProcessesDescription: "Description of boundary processes",
                exemptedEmissionsPercent: 0,
                exemptedEmissionsDescription: "Description of exempted emissions",
                packagingEmissionsIncluded: true,
              },
            },
          ],
        },
      };

      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            status: TestCaseResultStatus.FAILURE,
            errorMessage: expect.stringContaining("Product IDs do not match"),
          }),
        ],
        true
      );
    });

    test("sets mandatory flag correctly for non-mandatory versions", async () => {
      const nonMandatoryTestRun = createMockTestRun("V2.1", ["product1"]);
      storageMock.getTestRun.mockResolvedValue(nonMandatoryTestRun);

      const payload = {
        type: EventTypesV2.FULFILLED,
        data: {
          requestEventId: "run123-abc",
          pfs: [{ productIds: ["product1"] }],
        },
      };

      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            mandatory: false,
          }),
        ],
        true
      );
    });

    test("updates test run status after saving result", async () => {
      const testRun = { ...baseTestRun };
      storageMock.getTestRun.mockResolvedValue(testRun);

      const payload = {
        type: EventTypesV2.FULFILLED,
        data: {
          requestEventId: "run123-abc",
          pfs: [{ productIds: ["product1"] }],
        },
      };

      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.updateTestRunStatus).toHaveBeenCalledWith("run123");
    });
  });

  describe("processRejectedEvent (via processEvent)", () => {
    const baseTestRun = createMockTestRun("V2.2", ["product1"]);

    beforeEach(() => {
      storageMock.getTestRun.mockResolvedValue(baseTestRun);
    });

    test("saves success result for valid V2 rejected event", async () => {
      const payload = {
        type: EventTypesV2.REJECTED,
        data: {
          requestEventId: "run123-abc",
          error: { code: "INVALID_REQUEST", message: "Request validation failed" },
        },
      };

      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            name: "Test Case 14.B: Handle Rejected PCF Request",
            status: TestCaseResultStatus.SUCCESS,
            testKey: "TESTCASE#14.B",
            mandatory: true,
            documentationUrl: expect.stringContaining("v2-test-cases"),
          }),
        ],
        true
      );
    });

    test("saves success result for valid V3 rejected event", async () => {
      const v3TestRun = createMockTestRun("V3.0", ["product1"]);
      storageMock.getTestRun.mockResolvedValue(v3TestRun);

      const payload = {
        type: EventTypesV3.REJECTED,
        data: {
          requestEventId: "run123-abc",
          error: { code: "TIMEOUT", message: "Request timed out" },
        },
      };

      await (handler as any).processEvent(payload, "/3/events");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            status: TestCaseResultStatus.SUCCESS,
            documentationUrl: expect.stringContaining("v3-test-cases"),
          }),
        ],
        true
      );
    });

    test("saves failure result when error object is missing", async () => {
      const payload = {
        type: EventTypesV2.REJECTED,
        data: {
          requestEventId: "run123-abc",
        },
      };

      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            status: TestCaseResultStatus.FAILURE,
            errorMessage: expect.stringContaining(
              "Rejected event must contain an error object with a code and message"
            ),
          }),
        ],
        true
      );
    });

    test("saves failure result when error object is incomplete", async () => {
      const payload = {
        type: EventTypesV2.REJECTED,
        data: {
          requestEventId: "run123-abc",
          error: { code: "ERR" },
        },
      };

      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            status: TestCaseResultStatus.FAILURE,
            errorMessage: expect.stringContaining(
              "Rejected event must contain an error object with a code and message"
            ),
          }),
        ],
        true
      );
    });

    test("saves failure result when request path is incorrect", async () => {
      const payload = {
        type: EventTypesV2.REJECTED,
        data: {
          requestEventId: "run123-abc",
          error: { code: "ERR", message: "Error occurred" },
        },
      };

      await (handler as any).processEvent(payload, "/wrong/path");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            status: TestCaseResultStatus.FAILURE,
            errorMessage: expect.stringContaining(
              "Invalid request path: expected /2/events, but received /wrong/path"
            ),
          }),
        ],
        true
      );
    });

    test("combines error messages when both error object and path are invalid", async () => {
      const payload = {
        type: EventTypesV2.REJECTED,
        data: {
          requestEventId: "run123-abc",
        },
      };

      await (handler as any).processEvent(payload, "/wrong/path");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            status: TestCaseResultStatus.FAILURE,
            errorMessage: expect.stringMatching(
              /Rejected event must contain an error object.*Invalid request path/
            ),
          }),
        ],
        true
      );
    });

    test("sets mandatory flag correctly for non-mandatory versions", async () => {
      const nonMandatoryTestRun = createMockTestRun("V2.1", ["product1"]);
      storageMock.getTestRun.mockResolvedValue(nonMandatoryTestRun);

      const payload = {
        type: EventTypesV2.REJECTED,
        data: {
          requestEventId: "run123-abc",
          error: { code: "ERR", message: "Error" },
        },
      };

      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.saveTestCaseResults).toHaveBeenCalledWith(
        "run123",
        [
          expect.objectContaining({
            mandatory: false,
          }),
        ],
        true
      );
    });

    test("updates test run status after saving result", async () => {
      const mockResults = [{ status: TestCaseResultStatus.SUCCESS }];
      const testRun = { ...baseTestRun, results: mockResults };
      storageMock.getTestRun.mockResolvedValue(testRun);

      const payload = {
        type: EventTypesV2.REJECTED,
        data: {
          requestEventId: "run123-abc",
          error: { code: "ERR", message: "Error" },
        },
      };

      await (handler as any).processEvent(payload, "/2/events");

      expect(storageMock.updateTestRunStatus).toHaveBeenCalledWith("run123");
    });
  });
});