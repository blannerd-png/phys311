# Week 12 — PET Scanner Build Sprint Progress Log

**Project:** PET Scanner: Can It Find the Tumor?  
**Date last updated:** November 22, 2026  
**Live URL:** https://blannerd-png.github.io/phys311/project/ 
**Repository location:** `project/` in the PHYS 311 GitHub repository  
**AI disclosure:** AI was used to help organize and edit this progress report. The reported numerical test results come from the project's validation scripts.

## Part A — MUST Tier Status 

| MUST item | Status | Evidence / remaining verification |
| --- | --- | --- |
| Working scene and proper module layering | **Done** | The PET scanner runs from `project/main.js`, using separate `engine/`, `recon/`, and `render/` modules. The test suite confirms no DOM calls in `engine/` or `recon/`. The simulation has been used on a PC and an iPhone. |
| Original proposed MUST features | **Done** | The model displays a patient phantom, radioactive tracer emission, photon paths, detector coincidences, and reconstructed images. Point-source reconstruction is also covered by numerical tests. |
| Fixed timestep through an accumulator | **Implemented; performance limitation documented** | `runtime/fixedStep.js` uses Δt = 1/60 s. A synthetic test produced 60 simulation ticks over one second at 30, 60, and 120 render FPS. Live CPU-throttling tests showed that extreme workloads cause accumulated time to be discarded, although each executed step retains the fixed size. |
| One new physics feature | **Done** | Relativistic electron–positron annihilation is implemented with a Lorentz transformation, allowing the two 511 keV photons to deviate slightly from back-to-back emission while conserving four-momentum. The PET detector-coincidence model and tumor CNR calculation extend the simulation. |
| Keyboard-accessible interactions | **Implemented** | The simulation includes buttons, sliders, and keyboard controls such as Space, D, R, and period. |
| Full scene reset and E₀ baseline | **Implemented** | `Reset scene` / R rebuilds the initial phantom and settings, clears acquisition data, and establishes a new annihilation-event energy baseline when the next pair is generated. `Clear data` remains a separate control for repeated measurements with the same settings. |
| Deployment and clean browser console | **Deployed; console check to confirm** | The project is published at the URL above and has been tested on PC and iPhone. A final check for zero browser-console errors on the live site is still needed before claiming that part of the requirement is verified. |

### Fixed-Timestep and CPU-Throttling Verification

The simulation uses a fixed timestep of **1/60 s** with an accumulator, rather than using a variable physics timestep determined by the browser's current frame rate.

**Automated accumulator test:** Over one synthetic second, rendering schedules at 30, 60, and 120 FPS each produced exactly **60 physics ticks** (**PASS**).

**Live Chrome DevTools observations:**

| Measurement | 4× CPU slowdown | 6× CPU slowdown |
| --- | ---: | ---: |
| Measured FPS | 10.0 | 10.1 |
| Fixed simulation ticks (cumulative) | 4,257 | 3,978 |
| Backlog discarded (cumulative) | 11.383 s | 11.300 s |
| Latest-event energy drift | 0.00% | 0.00% |
| Latest-event momentum closure error | 5.65 × 10⁻¹⁴ keV/c | 4.98 × 10⁻¹⁴ keV/c |

The tests were recorded after different amounts of run time, so the cumulative tick and backlog values should **not** be compared as though the runs had equal duration. The data demonstrate that the simulation continued executing fixed-size steps and maintained numerical annihilation conservation under both throttling settings. However, its high computational cost caused time to be dropped from the accumulator, so **real-time progression was not maintained** during these heavily loaded runs. A matched-duration low-workload comparison would provide stronger live verification of frame-rate independence.

## Part B — Instrumentation and First Validation 

### B1 — Debug HUD 
<img width="660" height="477" alt="image" src="https://github.com/user-attachments/assets/6b1b0956-ca51-4783-9a9c-61be9fbbf4dd" />

**Implemented.** The diagnostics are activated using the **D** key or `?debug=1`. The displayed values include:

- Initial annihilating-pair energy E₀ and total photon energy
- Energy drift as a percentage of E₀, with a stated warning tolerance of **10⁻⁸%**
- Magnitude of total photon momentum and momentum closure error
- Positron-engine body count
- Contacts resolved this step (zero; PET photon transport has no rigid-body contacts)
- Maximum photon speed, approximately **2.998 × 10¹⁰ cm/s**
- Measured FPS, fixed simulation ticks, and discarded backlog

In the observed throttling screenshots, the drift readout was green and showed **0.00%**, consistent with the tolerance. The code implements a red drift warning beyond that threshold, but that warning state was not demonstrated by the screenshots.

**PET-specific interpretation:** The model does not conserve a single global mechanical energy during an ongoing radioactive acquisition. Instead, E₀ is the total initial energy of the *most recent* annihilating electron–positron pair, and the HUD measures how accurately the outgoing photons conserve that pair's energy and momentum.

### B2 — Conservative Test Mode 
<img width="607" height="143" alt="image" src="https://github.com/user-attachments/assets/2a9446db-7860-4695-81fb-d0d16a4ab69d" />

**Implemented and numerically validated.** A conservative-mode checkbox uses `runtime/conservative.js` to remove positron range/slowing, non-collinearity, attenuation, Compton scattering, detector inefficiency, and detector energy smearing. In this idealized mode, a stationary pair produces two **511 keV** photons traveling in opposite directions.

The automated conservative-mode validation produced **0.0000 keV** energy closure error and **0.0000 keV/c** momentum closure error at printed precision (**PASS**). Finite detector-ring geometry still limits which photons reach the detector. Because this is a PET photon model rather than a rigid-body collision simulation, a coefficient of restitution `e = 1` is not applicable.

### B3 — Two Week 11 Proposal Validation Tests (8 points)

The following tests correspond directly to **V1 and V3** in my Week 11 proposal. I reproduced their values using the project's `npm test` command, which runs `tests.mjs` and `week12_validation.mjs`.

| Test | Expected | Measured | Pass? |
| --- | --- | --- | --- |
| **V1 — Annihilation four-momentum conservation** (20,000 events) | Maximum energy error < 10⁻⁹ keV and maximum momentum error < 10⁻⁹ keV/c | Energy: **2.2737 × 10⁻¹³ keV**; momentum: **7.7536 × 10⁻¹⁴ keV/c** | **PASS** |
| **V3 — Beer–Lambert attenuation** (511 keV photons crossing 10 cm of water; scattering off) | Transmission probability **exp(−0.096 × 10) = 0.3829 ± 0.005** | Transmission fraction **0.3826** | **PASS** |

**Interpretation:** V1 shows that relativistic annihilation satisfies four-momentum conservation to numerical precision. V3 shows that the straight-line attenuation model reproduces the theoretical Beer–Lambert transmission probability within the prescribed tolerance.

**Additional validation:** All **29 original tests** and **4 Week 12 tests** passed. Other checks include non-collinearity of **0.499°** (expected 0.50° ± 0.05°), calibrated positron ranges for F-18/C-11/Ga-68/Rb-82, point-source reconstruction, coincidence handling, efficiency-squared scaling (**0.25341**, expected 0.25 ± 0.02), and the fixed-timestep test.

## Part C — Scope Decisions, Bugs, and Next Steps 

### Scope decisions

See `project/DECISIONS.md` for the dated, three-line **Decision / Reason / Cost-tradeoff** entries. The recorded decisions concern keeping the MUST tier limited, using event-level energy/momentum diagnostics for PET, separating `Clear data` from `Reset scene`, and avoiding claims of remote deployment or submission that had not yet occurred when those decisions were written.

### Two bugs fixed

**1. Physics/time-integration bug**

- **Symptom:** The original simulation acquired a fixed batch of decays once per animation frame. A lower rendering FPS therefore reduced the rate at which simulated decays were acquired.
- **Cause:** Acquisition advanced inside `requestAnimationFrame` without a fixed-step accumulator.
- **Fix:** Introduced `FixedStepAccumulator` and advanced acquisition in 1/60-s physics ticks rather than tying it directly to render calls.
- **Evidence:** Synthetic rendering schedules at 30, 60, and 120 FPS all generated 60 fixed ticks per synthetic second. Very heavy CPU load can still trigger an intentional backlog cap, which is displayed on the HUD.

**2. Scene-reset / interaction bug**

- **Symptom:** The original `Clear` button erased measurements but left altered tumor locations and detector settings in place.
- **Cause:** It reset acquisition counters without rebuilding the complete initial scene.
- **Fix:** Added `Reset scene` / R to restore the initial phantom, controls, acquisition state, and annihilation-event energy baseline. Kept `Clear data` as an independent experiment control.
- **Evidence:** The reset code and control are included in the project; the scene-reset behavior should be confirmed on the deployed page as part of final browser testing.

### First three Week 13 priorities

1. **Time-of-flight (TOF) reconstruction:** Quantify the improvement in tumor CNR as coincidence timing resolution changes, using matched events and uncertainty estimates.
2. **3D ring coverage and bed stepping:** Stress-test tumors outside a single bed's axial field of view, including the z = 9 cm, two-bed, and three-bed cases.
3. **Scatter and energy-window behavior:** Evaluate how Compton scatter and different accepted energy windows change reconstruction quality and tumor detectability.

These are revised technical priorities compared with the original Week 11 SHOULD list (isotope half-life, positron branching fractions, and expanded documentation). The change in priorities should be reflected in `DECISIONS.md` if it is retained.

### Deployment, discussions, and submission status

- **GitHub Pages:** Live URL supplied above; reported working on PC and iPhone.
- **Mobile bonus (+3 possible):** Tested on an iPhone.
  <img width="1290" height="2796" alt="image" src="https://github.com/user-attachments/assets/1ef3eb6f-50f5-4e0d-98cd-6e589b728c8d" />


- **Console check:** Confirm the live page has no JavaScript console errors during normal use.
- **Midweek Check-In:** Submit the live URL, MUST status, scope decision, and blocker; respond to one peer. **Canvas posting status not independently confirmed.**
- **Beta Review:** Submit the live URL, a brief description, one feedback request, and one stress-test suggestion. **Canvas posting status not independently confirmed.**
- **Progress log and decisions:** Commit `project/PROGRESS.md` and `project/DECISIONS.md`, and submit this progress log through Canvas.
- **Journal:** Submit the Week 12 journal through Canvas.
- **Commit bonus (+4 possible):** Only claim this if Git history actually shows at least 15 meaningful incremental commits this week.
- **Convergence bonus (+3 possible):** Only claim this if a timestep-halving convergence check was actually run and the measurements are documented.

### Known limitation

Under 4× and 6× CPU throttling, the live PET scanner remained usable but ran at approximately **10 FPS** and discarded accumulated time. This protects responsiveness while preserving the fixed size of each physics update, but it prevents the acquisition from advancing in lockstep with real-world time under severe load. This limitation is recorded rather than treated as a successful real-time performance test.
