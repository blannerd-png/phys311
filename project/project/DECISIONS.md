# Week 12 scope and implementation decisions

### November 17, 2026 — Keep the MUST tier narrow
**Decision:** Treat 3D PET coincidences and tumor CNR as the week's demonstrated new physics; retain TOF, bed stepping, and Compton scatter as optional extensions already in source.
**Reason:** The Week 12 rubric prioritizes a stable MUST implementation, instrumentation and deployment, not feature growth.
**Cost / tradeoff:** No new scanner physics modes were added; time was used to meet the required fixed step, HUD, conservative test and log.

### November 17, 2026 — Use event-level conservation metrics
**Decision:** Apply the energy-drift and momentum requirement to each e⁺e⁻ annihilation rather than claiming a global conserved mechanical energy for a radioactive source.
**Reason:** Injection of radioactive decay energy and attenuation means a global E₀ for the live acquisition is not conserved; photons are not rigid colliding balls.
**Cost / tradeoff:** The HUD reports body count = 1 (the positron engine), rigid-body contacts = 0 and maximum photon speed = c. Restitution e is not applicable.

### November 17, 2026 — Distinguish Clear data from Reset scene
**Decision:** Add full-scene reset, retaining Clear data for repeated measurements at chosen settings.
**Reason:** The original Clear button left altered phantom/detector settings in place and did not meet the reset-to-initial-condition requirement.
**Cost / tradeoff:** One extra button; R now performs full reset.

### November 17, 2026 — Do not claim remote steps happened
**Decision:** Package a GitHub Pages-ready project and drafts while marking publication and Canvas discussions unverified.
**Reason:** The submission requires a live URL and actual discussion posts, which cannot be inferred from local source files.
**Cost / tradeoff:** The owner must still upload/push and submit the provided files.
