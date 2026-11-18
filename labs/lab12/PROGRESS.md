# Week 12 — PET scanner build sprint progress log

**Project:** PET scanner: can it find the tumor?  
**Date prepared:** November 17, 2026  
**Live URL:** _not yet supplied / not published or verified from this workspace_  
**Source:** `project/` in the class GitHub repository

## A — MUST tier status

| MUST item | Status | Evidence / remaining verification |
|---|---|---|
| Scene runs from `project/main.js` with engine/render separation | **Implemented; live verification pending** | Assembled paths and ES module imports; all 29 Node physics/reconstruction checks pass. No `document` or Canvas usage in `engine/` or `recon/`. |
| Accumulator with fixed 1/60-s simulation timestep | **Implemented** | `runtime/fixedStep.js`; 30, 60 and 120 render FPS each produce 60 simulation ticks in 1 synthetic second. Browser DevTools CPU-throttle test remains to be done on the live site. |
| One new thing: simulated PET detector coincidences + tumor detectability | **Done in source** | 3D photon-pair simulation; configurable detection efficiency/timing; true/scatter/random coincidence sorting; reconstructed CNR and Rose criterion CNR ≥ 5. |
| Keyboard-accessible interaction | **Implemented** | Sliders, buttons and checkboxes plus Space, D, R, period and slice keys. |
| Reset builds initial scene and resets E₀ baseline | **Implemented** | Added **Reset scene** / R; rebuilds phantom, default controls and a zeroed acquisition. The event-level initial pair energy E₀ is re-established from the next annihilation. |
| GitHub Pages live and clean console | **Pending user deployment** | Files are Pages-ready and use relative paths; no live URL or deployed console verification available. |

## B1 — Debug HUD (12-point rubric)

**Implemented** as a D-key / `?debug=1` mode. Displays event-level total energy, drift (%) relative to E₀, total momentum magnitude, positron-engine body count, body contacts (0, because there are no rigid-body contacts), maximum propagation speed (c) and FPS. Energy drift changes to red when `abs(drift) > 1e-8%`. Also shows momentum closure and fixed ticks.

**PET-specific interpretation:** there is not a conserved global mechanical energy during ongoing radioactive decays, positron slowing, and detection. E₀ is the **initial e⁺e⁻ pair energy for the most recent annihilation**; the HUD checks the emitted gamma pair against it. A rigid-body restitution coefficient is not physically meaningful for a photon-transport model.

## B2 — Conservative test mode (10-point rubric)

**Implemented** as a checkbox. It disables positron slowing/range, non-collinearity, attenuation, Compton scattering, detector inefficiency and energy smearing. Photons propagate in straight lines and the pair is created at rest: 511 + 511 keV. The ring still has finite coverage, so detected events can be fewer than generated events. This is the applicable lossless limit for a PET detector, rather than a fictitious ball-collision e=1 setting.

## B3 — Two proposal-relevant numerical validation tests

Both were **executed** using `node week12_validation.mjs` (seeded, repeatable); values below are actual measurements from the supplied code and this run.

| Test | Expected numerical result | Measured | Pass? |
|---|---|---|---|
| Relativistic e⁺e⁻ → 2γ conservation over 20,000 annihilations | Max energy closure < 1×10⁻⁹ keV; max momentum closure < 1×10⁻⁹ keV/c | **2.2737×10⁻¹³ keV** energy; **7.7536×10⁻¹⁴ keV/c** momentum | **PASS** |
| Detected true pairs scale with per-photon efficiency ε² | `T(ε=0.5)/T(ε=1) = 0.25 ± 0.02` | `1170 / 4617 = 0.25341` | **PASS** |

Additional checks: idealized mode yielded zero energy and momentum closure within print precision; accumulator yielded **60, 60, 60** steps for render rates 30, 60, 120 FPS over 1 second. The original `npm test` suite passed **29/29** tests. These automated checks do **not** replace live browser verification.

## C — Week 12 scope decisions

See `DECISIONS.md` for 3-line decision entries.

## Two concrete bugs addressed

1. **Physics/time-integration bug** — **Symptom:** the original `main.js` acquired a fixed batch of decays once per visual frame; reducing browser FPS reduced the simulated acquisition rate, changing the number of events and measured tumor CNR at a given wall-clock interval. **Cause:** Monte Carlo advancement was tied to `requestAnimationFrame`, with no fixed-step accumulator. **Fix:** advance acquisition from `FixedStepAccumulator` at 1/60 s, independent of render frequency. **Evidence:** 30/60/120 FPS → 60/60/60 steps in one second. Heavy overload still drops backlog intentionally and is reported on HUD.
2. **Reset/interaction bug** — **Symptom:** the original **Clear** button discarded counts but preserved a moved tumor and changed detector settings, so the initial scene could not be restored in one action. **Cause:** only `clearData()` existed; it called `scanner.reset()` but never restored the phantom or UI defaults. **Fix:** add separate **Reset scene** button and R key handler; rebuild default phantom and default controls, reset acquisition and the event-energy baseline. Keep **Clear data** for intentionally restarting an experiment with the current parameters. **Evidence:** added handler and source checks; browser interaction still requires live verification.

## Week 13: first three SHOULD priorities

1. Validate and describe the **time-of-flight reconstruction** gain as CTR varies, using the already implemented TOF/normal comparisons and adding uncertainties.
2. Stress-test **3D ring coverage and bed stepping** at z = 9 cm, especially two- and three-bed cases, with an accessible public demo.
3. Evaluate the **scatter/energy-window** extension and report limitations; then finish the poster, documentation and deployment checks.

## Submission / verification remaining

- Push files to `project/`, configure GitHub Pages, open the exact live URL in an incognito tab, verify no console errors and repeat the D / conservative / reset interactions.
- Run DevTools CPU throttling with two frame rates and compare count progression over **equal simulated ticks** (not equal frames).
- Put the real live URL in the Canvas submission and the drafted check-in/beta posts; post them at the required times and reply to one peer.
- Submit journal and paste or attach this progress log in Canvas.
- Git history and any 15-commit bonus must reflect actual commits; none are claimed in this log.

**Known limitation:** the available sandbox Chromium browser blocks both localhost and file navigation (`ERR_BLOCKED_BY_ADMINISTRATOR`), so a full visual browser smoke test was not possible here. Node-based numerical and file integrity checks were run instead.
