import { TestRunWorker } from './test-run-worker';
import { TestStorage, TestRunStartParams, TestRunStatus, TestCaseResultStatus, TestResult } from '../types';
import { fetchOpenIdTokenEndpoint, getAccessToken } from './authUtils';
import { fetchFootprints, getLinksHeaderFromFootprints } from './fetchFootprints';
import { generateV2TestCases } from '../test-cases/v2-test-cases';
import { generateV3TestCases } from '../test-cases/v3-test-cases';
import { runTestCase } from './runTestCase';
import { BadRequestError } from '../errors';

jest.mock('./authUtils');
jest.mock('./fetchFootprints');
jest.mock('../test-cases/v2-test-cases');
jest.mock('../test-cases/v3-test-cases');
jest.mock('./runTestCase');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-run-id-123'),
}));

// Mock dependencies
jest.mock("../logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('TestRunWorker', () => {
  let testStorage: jest.Mocked<TestStorage>;
  let worker: TestRunWorker;
  let baseParams: TestRunStartParams;

  beforeEach(() => {
    jest.clearAllMocks();

    testStorage = {
      saveTestRun: jest.fn(),
      updateTestRunStatus: jest.fn(),
      saveTestCaseResults: jest.fn(),
      getTestRun: jest.fn(),
      getTestRunWithResults: jest.fn(),
    } as any;

    worker = new TestRunWorker(testStorage, 'http://webhook.url');

    baseParams = {
      baseUrl: 'https://api.example.com',
      clientId: 'client-123',
      clientSecret: 'secret-456',
      organizationName: 'Test Org',
      adminEmail: 'admin@test.com',
      adminName: 'Admin User',
      version: 'V3.0',
    };
  });

  describe('startTestRun', () => {
    it('should throw BadRequestError when baseUrl is missing', async () => {
      const params = { ...baseParams, baseUrl: '' };

      await expect(worker.startTestRun(params)).rejects.toThrow(BadRequestError);
      await expect(worker.startTestRun(params)).rejects.toThrow(
        'Missing required parameters: baseUrl, clientId, and clientSecret are mandatory.'
      );
    });

    it('should throw BadRequestError when clientId is missing', async () => {
      const params = { ...baseParams, clientId: '' };

      await expect(worker.startTestRun(params)).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when clientSecret is missing', async () => {
      const params = { ...baseParams, clientSecret: '' };

      await expect(worker.startTestRun(params)).rejects.toThrow(BadRequestError);
    });

    it('should execute V3 test run successfully', async () => {
      const mockFootprints = { data: [{ productIds: ['prod-1', 'prod-2'] }] };
      const mockPaginationLinks = { next: 'http://next.link' };
      const mockAccessToken = 'access-token-123';
      const mockTestCases = [{ name: 'Test Case 1' }, { name: 'Test Case 2' }];
      const mockResults: TestResult[] = [
        { status: TestCaseResultStatus.SUCCESS, name: 'Test Case 1', testKey: 'TEST-1', mandatory: true },
        { status: TestCaseResultStatus.SUCCESS, name: 'Test Case 2', testKey: 'TEST-2', mandatory: true },
      ];

      (fetchOpenIdTokenEndpoint as jest.Mock).mockResolvedValue('https://auth.example.com/token');
      (getAccessToken as jest.Mock).mockResolvedValue(mockAccessToken);
      (fetchFootprints as jest.Mock).mockResolvedValue(mockFootprints);
      (getLinksHeaderFromFootprints as jest.Mock).mockResolvedValue(mockPaginationLinks);
      (generateV3TestCases as jest.Mock).mockResolvedValue(mockTestCases);
      (runTestCase as jest.Mock).mockResolvedValue(mockResults[0]);
      testStorage.getTestRunWithResults.mockResolvedValue({
        testRunId: 'test-run-id-123',
        organizationName: 'Test Org',
        adminEmail: 'test@example.com',
        adminName: 'Test Admin',
        timestamp: '2024-01-01T00:00:00Z',
        techSpecVersion: 'V3.0',
        status: TestRunStatus.PASS,
        passingPercentage: 100,
        data: null,
        results: mockResults,
      });
      const result = await worker.startTestRun(baseParams);

      expect(testStorage.saveTestRun).toHaveBeenCalledWith(
        expect.objectContaining({
          testRunId: 'test-run-id-123',
          organizationName: 'Test Org',
          techSpecVersion: 'V3.0',
          status: TestRunStatus.FAIL,
        })
      );
      expect(fetchFootprints).toHaveBeenCalledWith(baseParams.baseUrl, mockAccessToken, 'V3.0');
      expect(generateV3TestCases).toHaveBeenCalled();
      expect(runTestCase).toHaveBeenCalledTimes(2);
      expect(testStorage.saveTestCaseResults).toHaveBeenCalledWith('test-run-id-123', expect.any(Array), false);
      expect(result.status).toBe(TestRunStatus.PASS);
      expect(result.passingPercentage).toBe(100);
    });

    it('should execute V2 test run successfully', async () => {
      const v2Params: TestRunStartParams = { ...baseParams, version: 'V2.2' };
      const mockFootprints = { data: [{ productIds: ['prod-1'] }] };
      const mockTestCases = [{ name: 'V2 Test Case' }];

      (fetchOpenIdTokenEndpoint as jest.Mock).mockResolvedValue(null);
      (getAccessToken as jest.Mock).mockResolvedValue('token');
      (fetchFootprints as jest.Mock).mockResolvedValue(mockFootprints);
      (getLinksHeaderFromFootprints as jest.Mock).mockResolvedValue({});
      (generateV2TestCases as jest.Mock).mockResolvedValue(mockTestCases);
      (runTestCase as jest.Mock).mockResolvedValue({ status: TestCaseResultStatus.SUCCESS });
      (testStorage.getTestRunWithResults as jest.Mock).mockResolvedValue({
        testRunId: 'test-run-id-123',
        organizationName: 'Test Org',
        adminEmail: 'test@example.com',
        adminName: 'Test Admin',
        timestamp: '2024-01-01T00:00:00Z',
        techSpecVersion: 'V2.2',
        status: TestRunStatus.PASS,
        passingPercentage: 100,
        data: null,
        results: []
      });
      const result = await worker.startTestRun(v2Params);

      expect(generateV2TestCases).toHaveBeenCalled();
      expect(generateV3TestCases).not.toHaveBeenCalled();
      expect(result.status).toBe(TestRunStatus.PASS);
      expect(result.passingPercentage).toBe(100);
    });

    it('should include optional auth parameters when provided', async () => {
      const paramsWithOptional = {
        ...baseParams,
        scope: 'read write',
        audience: 'api.example.com',
        resource: 'resource-id',
      };

      (fetchOpenIdTokenEndpoint as jest.Mock).mockResolvedValue('https://auth.example.com/token');
      (getAccessToken as jest.Mock).mockResolvedValue('token');
      (fetchFootprints as jest.Mock).mockResolvedValue({ data: [{ productIds: ['prod-1'] }] });
      (getLinksHeaderFromFootprints as jest.Mock).mockResolvedValue({});
      (generateV3TestCases as jest.Mock).mockResolvedValue([]);
      (testStorage.getTestRunWithResults as jest.Mock).mockResolvedValue({ results: [] });
      await worker.startTestRun(paramsWithOptional);

      expect(getAccessToken).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        paramsWithOptional.clientId,
        paramsWithOptional.clientSecret,
        expect.stringContaining('scope=read+write')
      );
    });

    it('should use customAuthBaseUrl when provided', async () => {
      const paramsWithCustomAuth = {
        ...baseParams,
        customAuthBaseUrl: 'https://custom-auth.example.com',
      };

      (fetchOpenIdTokenEndpoint as jest.Mock).mockResolvedValue(null);
      (getAccessToken as jest.Mock).mockResolvedValue('token');
      (fetchFootprints as jest.Mock).mockResolvedValue({ data: [{ productIds: ['prod-1'] }] });
      (getLinksHeaderFromFootprints as jest.Mock).mockResolvedValue({});
      (generateV3TestCases as jest.Mock).mockResolvedValue([]);
      (testStorage.getTestRunWithResults as jest.Mock).mockResolvedValue({ results: [] });
      await worker.startTestRun(paramsWithCustomAuth);

      expect(fetchOpenIdTokenEndpoint).toHaveBeenCalledWith('https://custom-auth.example.com');
    });
  });
});