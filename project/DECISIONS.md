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


# Week 13 — November 26, 2026

- **Simplify first view.** Keep scanner, reconstructed image, detection result and four experiment sliders visible; move all specialist controls, truth image, side view, sinogram, coronal image, spectrum and statistics into closed native disclosure sections. Remove the decorative header badge, redundant canvas hardware text and default track inset and default background ROI overlays (still optional in acquisition settings); limit rendered recent LORs to 36 to reduce clutter (acquisition unchanged). Add 10 cm scale and plain-language labels. Preserve all preexisting DOM IDs and controls.
- **Performance polish.** Default speed is 5,000 instead of 20,000 decays per acquisition tick; label the unit correctly. Render side/coronal/sinogram/spectrum views only when expanded. Add a regular canvas fallback when OffscreenCanvas is unavailable. Resize the side canvas when opened; avoid setting hidden canvases to 1 px. Fix conservative mode reset of the upper energy window to 650 keV when returning to standard settings. No change to event generation/reconstruction algorithms.
- **SHOULD scope per original proposal.** Half-life timer/evolving activity, explicit positron branching fractions, Cu-64 and V6 deferred: these require changes to decay-time sampling, isotope presets and the previous constant-activity study. Maintain a stable validated scanner and document that the current activity is constant. Four isotopes and static half-life metadata exist; dynamic decay and branching are not simulated. The README and validation report are completed. The email-driven TOF and 3D bed-stepping extensions were already implemented and remain available.
- **COULD deferrals.** Prompt gammas, detector dead time, user-defined isotopes and a new detector-noise threshold are not implemented; Compton scatter, multiple phantoms and energy windows are retained. No clinical accuracy claim.
- **Numerical finding.** Combined scattering and stopping can artificially raise kinetic energy for deliberately extreme angular kicks. Preserve existing calibrated model and disclose stress values instead of silently modifying established results. First-order stopping convergence is expected for Euler-Cromer.
- **External requirements.** No real-phone check, updated live deployment, peer feedback or recording was performed in this environment. Browser navigation was blocked. Complete those steps before submission; do not treat static verification as user testing.
