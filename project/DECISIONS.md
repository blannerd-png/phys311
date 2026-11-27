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

### November 17, 2026 — Do not claim remote steps happened
**Decision:** Package a GitHub Pages-ready project and drafts while marking publication and Canvas discussions unverified.
**Reason:** The submission requires a live URL and actual discussion posts, which cannot be inferred from local source files.
**Cost / tradeoff:** The owner must still upload/push and submit the provided files.
