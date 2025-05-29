# Automated Conformance Testing FAQ

### What is tested by the Atomated Conformance Testing tool?
Mandatory functionality of the PACT Technical Specifications are tested. The tool runs a comprehensive set of test cases, which varies by Technical Specification version. Test cases include both a validation of teh data model schema as well as mandatory API functionality. See the set of test cases [here](docs/ACT_Test_Cases.pdf)

### What solution pre-requisites are required to pass all tests?
- Solution must implement all mandatory functionality of the PACT Technical Specifications
- Solution must return 2 or more PCFs via a call to ListFootprints, i.e. solution must have 2 PCFs available and pre-configured to release these PCFs to the ACT tool

### How is Authentication information handled?
ACT requires users to provide the Solution API URl and `client_id` and `client_secret` to authentication to their solution and run tests. This authentication information is only stored in memory during testing and will never be saved nor transferred.

### Is there a time duration for the testing suite?
Yes, the conformance tool expects the test solution responds to each test case after some duration, and if a response is not received by this duration (i.e. timeout duration), the test case fails. The timeout differs between synchronous and asynchronous test cases; for synchronous test cases, the time duration is 2 seconds. For asynchronous test cases, it is 30 seconds.

