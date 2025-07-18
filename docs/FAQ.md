# Conformance Testing FAQ

### What is tested by the Conformance tool?
Mandatory functionality of the PACT Technical Specifications are tested. The tool runs a comprehensive set of test cases, which varies by Technical Specification version. Test cases include both a validation of the data model schema as well as mandatory API functionality. See [Test Cases V2](https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v2-test-cases-expected-results.md) and [Test Cases V3](https://github.com/wbcsd/pact-conformance-service/blob/main/docs/v3-test-cases-expected-results.md).

### What solution pre-requisites are required to pass all tests?
- Build a PACT Conformant Solution (or at least partial PACT Conformant Solution) based on [PACT Tech Specs](https://docs.carbon-transparency.org/) (Version 2.X or 3.X)
- Configure your solution to be able to authenticate the Conformance tool's endpoint and make Action Event requests the tool will accept using the following credentials (see [sourcecode](https://github.com/wbcsd/pact-conformance-test-service/blob/main/src/lambda/authForAsyncListener.ts) for details).
    - clientId: `test_client_id`
    - clientSecret: `test_client_secret`
    - URL: https://conformance.services.carbon-transparency.org
- Solution must return 2 or more PCFs via a call to ListFootprints, i.e. solution must have 2 PCFs available and pre-configured to release these PCFs to the Conformance tool

### How is Authentication information handled?
The Conformance tool requires users to provide the Solution API URl and `client_id` and `client_secret` to authentication to their solution and run tests. This authentication information is only stored in memory during testing and will never be saved nor transferred.

### Is there a time duration for the testing suite?
Yes, the conformance tool expects the test solution responds to each test case after some duration, and if a response is not received by this duration (i.e. timeout duration), the test case fails. The timeout differs between synchronous and asynchronous test cases; for synchronous test cases, the time duration is 2 seconds. For asynchronous test cases, it is 30 seconds.

