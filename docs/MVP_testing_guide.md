# Guide to testing Automated Conformance Testing MVP

## Why participate in testing?
- Organizations that participate in MVP testing of ACT will gain early access to the service, provide feedback to influence its direction, be promoted as early testers of the MVP, and be well-prepared to quickly pass conformance when the ACT becomes mandatory
- Any organization globally may participate in testing ACT MVP, provided the organization has built or is building a PACT Conformant Solution implementing PACT Tech Specs V2.X.X. There is no cost to participate in testing.
- Testing is estimated to take no more than 1 hour, assuming the organization has a solution already built and ready for testing

## How to join testing?
To test ACT MVP you need a registration code, please email Beth Hadley (hadley@wbcsd.org) for a code.

## Timeline for testing?
The MVP testing phase kicked off March 20, 2025 - we encourage organizations to begin testing asap!

## Pre-requisites to testing
Before beginning testing, organizations must complete the following pre-requisites:
- Build a PACT Conformant Solution (or at least partial PACT Conformant Solution) based on [PACT Tech Specs](https://docs.carbon-transparency.org/) Version 2.0, 2.1, 2.2, or 2.3: 
- Configure your solution to be able to authenticate ACT's endpoint and make Action Event requests ACT will accept using the following credentials (see [sourcecode]( https://github.com/wbcsd/pact-conformance-test-service/blob/main/src/lambda/authForAsyncListener.ts) for details).
  - clientId: `test_client_id`
  - clientSecret: `test_client_secret`

## Testing Instructions
- Register to [PACT Network](https://pact-directory-portal.onrender.com/) to begin testing. Note that not all information is strictly required to conduct conformance testing, but as ACT is built in the same environment as Identity Management, the sign-up interfaces are similar. We are refining the sign-up UI for public launch and welcome your feedback.
- You are taken to a page with your company profile. The pages "My Profile", "Search", and "Manage Connections" are functionality of the PACT Identity Management service, which you are welcome to explore and test but are not relevant to Automated Conformance Testing. See [Identity Management GitHub](https://github.com/wbcsd/pact-directory).
- Go to "Conformance Testing"
- Enter in details, and click "Run tests"; the rest should be self-explanatory
- As you proceed, if you encounter issues, especially technical issues, we prefer you to raise an isssue in GitHub (https://github.com/wbcsd/pact-conformance-test-service/blob/main/docs/MVP_testing_guide.md) if possible. This helps us triage issues and rapidly address your feedback.
- We encourage you to make note of all feedback, and either raise a GitHub issue, write to Beth Hadley (hadley@wbcsd.org), or share the feedback during the Network Services Sub-WG. 
- We look forward to your feedback and revising the MVP accordingly!

