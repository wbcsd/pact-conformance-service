# Self-hosted Version of PACT Conformance Service for ACT

This repository contains a copy of [PACT's Conformance Service](https://github.com/wbcsd/pact-conformance-service), used on [ACT](https://github.com/sine-fdn/conformance-test).

It is not a forked repository. Rather, it is an independent clone, kept in sync with the `wbcsd/pact-conformance-service`. 

## `ileap` branch

The default branch of this repository is `ileap` and not `main`.

`ileap` contains a Dockerfile and a fly.toml used for deployment, as well as CI/CD GitHub workflows.

Additionally, `ileap` contains a fix to `wbcsd/pact-conformance-service`, which has been reported [here](https://github.com/wbcsd/pact-conformance-service/issues/236). Other than that, the code does not diverge from upstream.

## Syncing

The workflow Sync from upstream is triggered automatically every two weeks. 

It updates branches `main` and `develop` to their most up to date version on `wbcsd/pact-conformance-service`.

Branch `ileap` stays intact. Updating `ileap` must be done manually, since changes to `main` can break ACT. 

## Deployment

Branch `ileap` is deployed on fly.io, with the database on Neon.

Pushes to `ileap` trigger the migrations on the database and the redeployment, through the CI/CD pipeline.

---

## PACT Conformance Tool

### About this Project
PACT publishes  [Technical Specifications for PCF Data Exchange](https://docs.carbon-transparency.org/), which any organization or company can implement. Software solutions that implement the PACT Technical Specifications are known as [PACT Conformant Solutions](https://www.carbon-transparency.org/network). This GitHub repository creates a conformance tool which enables organizations to automatically assess their implementation of the specifications, and become PACT Conformant. The tool is a service of [PACT Network Services](https://www.carbon-transparency.org/pact-network-services).

### Access the tool
Use of the tool is free and open to anyone. Sign up and start using the tool at https://services.carbon-transparency.org/

### Timeline
- PACT released an MVP version of the service in March 2025, which can now be used for testing. 
- PACT is releasing a production version of the tool in June 2025, which must be used to gain PACT Conformance status

### Acknowledgements
This project would not have been possible without the generous time and contributions from the following:
- [Takuro Okada](mailto:t2-okada@nri.co.jp), who built an open-source command-line automated conformance testing tool and released this to the PACT community in September 2024, which served as a foundation and inspiration for this project
- [SINE Foundation](https://sine.foundation/), who proposed and built an early automated conformance testing tool, and advocated for the introduction of such a tool to the community
- [Patrick J McGovern Foundation](https://www.mcgovern.org/) for generously supporting this work
- The PACT community for active engagement and testing of the tool, and for providing feedback

###  Context
PACT began running a conformance testing process in May 2023, shortly after the publication of V2 of the PACT Technical Specifications. From May 2023 to February 2025, conformance was conducted through manual peer-to-peer testing, [learn more here](https://www.carbon-transparency.org/guides/guide-join-pact-network). This conformance tool replaces the peer-to-peer testing process, which both accelerates testing and improves the rigor and reliability of PACT Conformance status.

### Questions, Feedback?
Check out our FAQ and/or raise a GitHub [issue](https://github.com/wbcsd/pact-conformance-test-service/issues).

### How to get involved
We welcome any organization globally to get involved in this project. Write to us at pact-support@wbcsd.org to get involved!

### License
[MIT](https://opensource.org/license/mit)
