# V2 Deprecation Policy

## Summary

Part of the PACT’s continued improvement of the Technical Specification, includes the release of new versions of the specification.  

PACT uses [Semantic Versioning](https://semver.org/) to maintain versions of the Technical Specifications. In summary, this implies:

- **MINOR changes** (e.g., V2.3.x to V2.2.x) are **backwards compatible,** meaning changes between minor versions will not impact interoperability
- **MAJOR changes** (e.g., V3.x.x to V2.x.x) are **not backwards compatible**, as they may introduce or remove functionality which will break interoperability between major versions. Thus, only solutions running the same major version (i.e. V2.3 and V2.1) are interoperable.

With the general release of the PACT Technical Specifications V3.0,  the PACT Technical Specifications V2.x will be deprecated in April 2026, as per the [PACT Release Plan](https://github.com/wbcsd/data-exchange-protocol/blob/main/RELEASE-PLAN.md). This will have an impact on solutions that are built on the PACT Technical Specifications V2.x and haven’t implemented the PACT Technical Specifications V3.x by April 2026.  

## Impact of Deprecation

As of **April 2026**, PACT Technical Specifications V2.x will be deprecated and no longer officially supported by PACT. This has the following implications for users:

- **Transition Period**: Between June 2025 and April 2026, PACT encourages solutions upgrade their implementation of the PACT Technical Specifications and is available to support solutions doing so.
    
    The PACT Conformance Tool will facilitate testing for both PACT Technical Specifications V2.x and PACT Technical Specifications V3.x.
    
- **Website Listing**: Solutions not conformant to PACT V3.0 or higher by April 2026 will be removed from the PACT website.

## Key Milestones to V3 Conformance

- April 2025: PACT Technical Specifications V3 released
- June 2025: PACT Conformance tool released
- April 2026: PACT Technical Specifications V2 deprecated

### Support

PACT is happy to support you during your transition to V3! Please write to pact-support@wbcsd.org with any questions.
