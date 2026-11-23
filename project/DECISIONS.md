# Week 12 — Scope and Implementation Decisions
Disclaimer: AI was used to help format this document. 
## November 17, 2026 — Keep the MUST Tier Narrow

**Decision:** Focus the MUST tier on relativistic electron–positron annihilation, PET detector coincidences, and tumor detectability. Retain time-of-flight reconstruction, bed stepping, and Compton scattering as optional extensions.

**Reason:** The Week 12 rubric prioritizes a stable MUST implementation, instrumentation, and deployment rather than adding more features.

**Cost / tradeoff:** No additional scanner physics modes were prioritized. Development time was dedicated to implementing the fixed timestep, debug HUD, conservative test mode, and progress documentation.

## November 17, 2026 — Use Event-Level Conservation Metrics

**Decision:** Apply the energy-drift and momentum requirements to each electron–positron annihilation rather than claiming globally conserved mechanical energy throughout a radioactive acquisition.

**Reason:** Radioactive decay introduces energy into the simulation, while positron slowing and photon attenuation are dissipative processes. Therefore, the energy of the entire acquisition is not conserved in the same way as a closed mechanical system.

**Cost / tradeoff:** The debug HUD reports conservation for the most recent annihilation event. Body count refers to the internal positron engine, rigid-body contacts are zero, and the maximum photon speed is the speed of light. A coefficient of restitution is not applicable.

## November 17, 2026 — Distinguish Clear Data from Reset Scene

**Decision:** Add a full-scene reset while retaining the original Clear Data functionality for repeated measurements at selected settings.

**Reason:** The original Clear button reset acquisition data but did not restore the phantom or detector parameters to their initial conditions.

**Cost / tradeoff:** One additional button was introduced, and the R key now performs a complete scene reset. This improves reproducibility but requires maintaining two separate reset behaviors.

## November 17, 2026 — Document Deployment Status Accurately

**Decision:** Prepare a GitHub Pages-ready project and discussion drafts while identifying deployment and Canvas submissions as unverified until completed.

**Reason:** The assignment requires a functioning public URL and actual discussion submissions, neither of which can be verified from source code alone.

**Cost / tradeoff:** Additional time was required for deployment and browser testing. The project was subsequently published and tested on multiple devices.

---

## November 22, 2026 — Verify GitHub Pages Deployment

**Decision:** Deploy the completed PET scanner simulation to GitHub Pages and test its functionality on both a PC and an iPhone.

**Reason:** The Week 12 assignment requires a publicly accessible simulation that works outside the local development environment. Testing on multiple devices also helps identify compatibility and performance issues.

**Cost / tradeoff:** Time was dedicated to deployment verification rather than additional physics features. An intermittent HTTP 503 resource-loading error was observed, but refreshing restored normal operation. Final console verification remains important.

## November 22, 2026 — Retain Fixed Timestep with a Performance Safeguard

**Decision:** Keep the 1/60-second fixed-timestep accumulator and its limit on catch-up steps under heavy computational loads.

**Reason:** CPU-throttling tests at 4× and 6× slowdown showed that the simulation maintained accurate energy and momentum conservation but experienced reduced frame rates and accumulated backlog.

**Cost / tradeoff:** Under significant computational load, the simulation discards accumulated time to prevent excessive processing and freezing. Although individual physics steps remain fixed, the acquisition may progress more slowly than real time.

## November 22, 2026 — Prioritize PET Reconstruction Improvements for Week 13

**Decision:** Focus the next development phase on time-of-flight reconstruction, 3D detector coverage and bed stepping, and Compton scatter/energy-window behavior.

**Reason:** The core PET simulation and numerical validation are functioning. These features provide opportunities to investigate how detector performance and photon interactions influence reconstructed image quality and tumor detectability.

**Cost / tradeoff:** The originally proposed SHOULD features involving isotope half-life and positron branching fractions are deferred while reconstruction validation, documentation, and performance improvements take priority.
