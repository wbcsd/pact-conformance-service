# Conformance Tool Beta Retesting Policy
The PACT Conformance tool is the source of truth to assess whether a given solution is PACT Conformant. PACT deeply values the integrity of PACT Conformance status, and therefore ensuring the tool is accurate, comprehensive, and rigorous is critical. However, we recognize it is impossible to guarantee the tool will be entirely bug-free and comprehensive upon launch, despite prior testing. Therefore, when a new version of the test suite is launched (corresponding to a new Tech Specs minor or major release), this version will be indicated in "Beta Phase", as indicated by the drop-down in the conformance testing configuration page. We present below PACT's policy mandating retesting during the Beta phase of a test suite.

## Conformance subject to potential retesting in Beta Phase
The following policy was determined in consultation with the PACT community, and is a compromise between 1) ensuring and enforcing the integrity of PACT Conformance and 2) not imposing an undue burden or requirement on Solution Providers to mandate retesting (and/or undue burden on PACT organization to enforce mandatory retesting indefinitely), which ultimately the (ideally) the market should enforce.

* When a given test suite version is in "Beta Phase", PACT may identify and resolve an issue with the tool resulting in a solution which previously passed the testing suite for a given version of the Tech Specs to no longer pass the test suite for that same version.
* Should a mandatory retesting scenario occur:
  * If PACT determines that a new version of the tool requires existing conformant solutions to undergo retesting, PACT will notify the Solution Provider, granting them 60 days to re-demonstrate conformance
  * During this time the Solution Provider will continue to be promoted through PACT marketing channels as before (i.e. via PACT website, at events, etc.)
  * Should the Solution Provider fail to re-demonstrate conformance by the deadline, PACT will inform the Solution Provider, remove their conformance status, and remove the solution from PACT marketing channels. Should the organization at some point in the future demonstrate conformance, PACT will promote the organization as conformant as usual.
* When a given test suite version is no longer in "Beta Phase", PACT will not require mandatory retesting to retain conformance status, however upon releases of the tool, PACT will inform Solution Providers and encourage retesting.

Solution Providers are regardless encouraged to periodically retest to later versions of the tool, even if not mandated to do so. Further PACT also encourage the customers (and/or potential customers) of Solution Providers to request or mandate re-testing if they have reason to believe their Solution Provider is no longer conformant.

## Tool Versioning Scheme
To ensure clarity and transparency when changes are made to the tool, especially changes to the testing suite, PACT will version the tool as follows:

- The tool releases will be numbered according to [semantic versioning](https://semver.org/)
- Every minor and major release of the PACT Technical Specifications will correspond to a related tool release; the tool however will release much more frequently than PACT Tech Specs
- Each testing suite (corresponding to a given major/minor version of the Tech Specs) will be indicated as either in "Beta Phase" or "General Release" phase. PACT will determine when to promote a version to "General Release" phase, once the testing suite is stabilized and robust to ensure conformance results are fully reliable and integrous, which will take into consideration issue rate, number of solutions having 100% tests passing, time to conformance, etc.

## Tool / Tech Specs discrepancy resolution process
PACT acknowledges that during the use of the tool, the community may encounter questions regarding discrepancies and/or differences of interpretation between the Tech Specs and the tool. This is expected and our goal with the tool is to systematically address and remove these discrepancies, thus driving interoperability robustness. We will use the process defined below to resolve discrepancies / issues as a community,

* During use of the tool, a Solution Provider is expected to share feedback if they encounter any of the following, per their interpretation: 
  * a test case of the tool does not correctly implement the PACT Tech Specs
  * PACT Tech Specs are ambiguous and therefore a discrepancy exists between the tool and PACT Tech Specs
  * a test case is missing in the tool which the Solution Provider believes is mandatory and should be tested 
* A Solution Provider is requested to raise a [GitHub issue](https://github.com/wbcsd/pact-conformance-test-service/issues) documenting: 
  * The test case
  * The problem observed
  * Proposed resolution (i.e. to Tech Specs and/or the tool)
* PACT will review issues regularly and triage accordingly:
  * Issues having implications to conformance for Solution Providers (i.e. discrepancies in interpretation, ambiguity, etc.) will be raised to PACT Technology Working Group, consensus reached, and corresponding updates to PACT Tech Specs and/or the tool will be implemented
  * Issues that do not require consultation from Working Group (i.e. obvious bugs, etc.) will be resolved directly by PACT team
  * Every attempt will be made to update the PACT Tech Specs to iteratively remove ambiguities and retain the PACT Tech Specs as the source of truth, with the tool implementing the PACT Tech Specs
* PACT will close the issue and log the corresponding decision made; PACT will update the tool and the update will be made available in the next release
* Depending on the severity of the issue raised and whether the test suite is in Beta Phase, a conformance retesting period may be required.


 
