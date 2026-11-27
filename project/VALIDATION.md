# Week 13 — Validation report

**Project:** PET scanner: can it find the tumor?  
**Date:** November 26, 2026  
**Live URL (existing address; updated deployment pending):** https://blannerd-png.github.io/phys311/project/#simulation

This report uses measured output from the bundled source. Run `npm test` and `node convergence.js` in `project/`. Logs: `results/week13-tests.txt`, `results/week13-convergence.txt`, and machine-readable `results/week13-numerical.json`. The earlier detector performance study is preserved in `results/summary.md`; it was not rerun in this revision. AI helped organize the report, write the headless test, and refactor the interface. No peer or real-device checks are represented as completed.

## B1 — Headless convergence study

Photon rays, Lorentz boosts and sampled decay times are evaluated analytically; they do not use an ODE timestep. The meaningful timestep study is the actual Lab 9 `World`/`Body`/`StoppingForce`/`EulerCromer` used by positron transport. To avoid mixing random kicks and calibration into the discretization error, use one body, m=1, x₀=0, v₀=1, b=1, no scattering, no walls, no collisions, fixed normalized end time T=0.2. This is a deterministic reduced scene, not a clinical track. The production solver uses adaptive dt=ηv³/b (η=0.05) and a stopping threshold; this study instead holds dt fixed. All values here are normalized engine units, not physical seconds or centimeters.

For positive velocity, dv/dt=−b/v². Integration gives v(t)=(1−3bt)^(1/3), and x(t)=[1−(1−3bt)^(4/3)]/(4b). At T=0.2, x_exact=0.176319370027 and v_exact=0.736806299728.

| Δt | Steps | x(T) | Error vs finest | Error vs exact | Previous/current finest error | Exact-error order |
|---:|---:|---:|---:|---:|---:|---:|
| 0.016666667 | 12 | 0.174783779 | 1.511262e-03 | 1.535591e-03 | — | — |
| 0.008333333 | 24 | 0.175546207 | 7.488340e-04 | 7.731634e-04 | 2.018 | 0.990 |
| 0.004166667 | 48 | 0.175931412 | 3.636287e-04 | 3.879581e-04 | 2.059 | 0.995 |
| 0.002083333 | 96 | 0.176125042 | 1.699983e-04 | 1.943277e-04 | 2.139 | 0.997 |
| 0.001041667 | 192 | 0.176222118 | 7.292216e-05 | 9.725156e-05 | 2.331 | 0.999 |
| 0.000520833 | 384 | 0.176270722 | 2.431838e-05 | 4.864778e-05 | 2.999 | 0.999 |
| 0.000260417 | 768 | 0.176295041 | 0.000000e+00 | 2.432940e-05 | — | 1.000 |

The first ratios are about 2.02 and 2.06. Near the finest reference, the ratio is biased upward because that reference has its own error. The exact solution independently gives p=log₂(e_coarse/e_fine)≈1.000. Euler-Cromer is first-order in general even though it can have bounded energy error in some conservative problems; the rubric’s suggested second-order expectation does not apply to this velocity-dependent stopping ODE. Verlet’s familiar second-order guarantee also assumes suitable position-dependent forces. No forced second-order claim is made.

## B2 — Conservation, integrator comparison and stress

### Isolated conservative engine

Turn stopping and scattering off. Run a single body with m=1, v₀=1, E₀=0.5, |p₀|=1, dt=1/60, 3,600 steps, T=60 normalized time units. Both Euler-Cromer and Velocity Verlet produce E=0.5, relative energy drift 0, relative momentum error 0. Position is 59.999999999997875 rather than 60 (floating-point summation). The difference in energy drift is 0. This is a force-free baseline, not evidence of superiority for either integrator. Angular momentum is not a central-force/free-rotation observable in the PET model.

### Actual PET conservative limit

For 100,000 annihilations per case, with deterministic seed 2026:

| Case | Max relative pair energy error | Max absolute momentum closure (keV/c) | Max relative momentum closure |
|---|---:|---:|---:|
| Ideal, pair at rest | 0 | 0 | undefined (p₀=0) |
| Nominal σ=1.9 keV/c | 2.225e-16 | 8.778e-14 | 9.867e-13 |
| Artificial stress σ=1000 keV/c | 2.596e-16 | 1.456e-12 | 1.594e-15 |

A separate ideal acquisition with 100 batches of 1000 decays at 100 kBq (no attenuation/scatter/range/non-collinearity; perfect detector) spans 1.00158 simulated physical seconds and records 3755 true pairs, zero scatter/random pairs for this seed. Finite axial/geometric acceptance still prevents all photons from reaching detectors. There is no global mechanical E₀ for a radioactive scan: energy is injected by decays, transferred into tissue, or carried out. Annihilation conserves pair four-momentum event-by-event. Photons have no numerical integrator; the 1/60-s browser tick is an acquisition scheduler, not photon flight time.

### Non-conservative integrator comparison

For the stopping-only case at dt=1/240, T=0.2, compare the same initial scene with the three existing integrators:

| Integrator | x(T) | K(T) | Relative energy change (physical loss + numerical error) |
|---|---:|---:|---:|
| Euler | 0.177018468 | 0.273139149 | 45.3722% |
| Euler-Cromer | 0.175931412 | 0.273139149 | 45.3722% |
| Velocity Verlet | 0.176398892 | 0.272297824 | 45.5404% |

Exact K(T)=0.271441762; Verlet is closer here, but this is not a conservative drift comparison and does not establish second-order performance with drag. The force-free comparison above reports the required conservative drift difference.

### Worst-case stress and scattering

With stopping disabled, Euler-Cromer, σ=0.35, 1000 steps of dt=0.001, speed is 0.9999999999999996 (relative speed error 4.44e-16); maximum single-step energy increase is 2.22e-16 from rounding. Momentum direction changes due to scattering, so it is not a closed particle-only system.

With simultaneous stopping and scattering, 20 seeds per σ, dt=1/60, T=0.2, max positive single-step energy changes are 0 at σ=0 and 0.35, 0.01683 at σ=1, and 0.01847 at σ=2 (seed 6). At the worst tested artificial angle, the increase is 3.69% of initial K=0.5. The combined explicit kick and drag do not strictly commute: rotating v and subtracting a drag increment along its old direction can increase the norm for large angles. These extremes are not UI parameters and the production η=0.05 uses variable dt, but the finding exposes the approximation; no claim of energy monotonicity for every stochastic path. Fixing with split rotation/stopping and recalibrating the range tables is deferred to avoid changing the established physics study at submission. The separate extreme annihilation case remains at round-off level.

## B3 — Analytic limits and energy ledger

| Test | Analytic | Measured | Relative difference |
|---|---:|---:|---:|
| 10 cm water transmission, μ=0.096 cm⁻¹ | exp(−0.96)=0.382893 | 0.3826 (100,000 rays) | 0.077% |
| Pair detection ratio (ε=0.5 vs 1) | 0.25 | 1170/4617=0.25341 | 1.36% |
| 511 keV Compton backscatter | 511/3=170.333 keV | 170.333 keV | < 10⁻⁹ keV absolute |
| Stopping displacement (finest dt) | 0.176319370 | 0.176295041 | 0.0138% |

Transmission and efficiency have finite Monte Carlo uncertainty; sorting and geometry may also affect pair counts. The range checks (F-18 0.555 vs 0.57 mm, C-11 0.997 vs 1.02 mm, Ga-68 2.625 vs 2.69 mm, Rb-82 5.589 vs 5.33 mm) agree within 5% but are calibration checks rather than independent predictions. FBP point at (5,0) cm reconstructed to (4.999,−0.005) cm; MLEM count ratio 0.9999998. Full output in test log.

Stopping-only work ledger: K=½v², F·v=−b/v. Independently accumulate W=Σ(−b/vᵢ)Δt using pre-step velocities (left Riemann sum), compare with K_final−K_initial. At Δt=0.000260417, T=0.2, ΔK=-0.228450406, W=-0.228496863, absolute mismatch=4.645622e-05, relative to |ΔK|=0.0203%. It meets a 0.05% tolerance at this dt. At dt=1/60 mismatch is 0.002770 (about 1.25% of |ΔK|). The residual decreases with timestep. This ledger covers the stopping-only classical subsystem, not stochastic scattering, photons removed by attenuation, or energy deposited in tissue, which are not tracked in a complete calorimetric ledger. No rigid inelastic collision test applies.

## B4 — Limits, validity and performance

- The fixed-step convergence range tested is 1/60 to 1/3840 in normalized units over T=0.2, before stopping singularity t=1/3. This is not a validated physical time range for a full positron path. Actual production uses η=0.05 and v_stop=0.04; track guard 2000 steps. Extreme simultaneous scatter/drag can give artificial gains as above.
- One internal positron body; bulk decays use a 4000-entry calibrated displacement table. Photon rays are processed in batches rather than N-body dynamics. The 1/60-s browser scheduler caps catch-up at five steps and drops overload backlog. Available speed spans 1–50,000 decays/tick; default reduced from 20,000 to 5,000. No measured real-phone or browser FPS threshold is claimed; high rates and iterative reconstructions can overload slower devices. Hidden side/coronal/sinogram/spectrum rendering is deferred until opened.
- 40 cm detector radius, 512 crystals per ring, 1–48 rings, 0.5 cm axial pitch; finite geometry limits sensitivity. Short 0.4 s detector sweep at 50 MBq, 20 million decays per scan, 3 seeds, estimated grid CNR uncertainty roughly ±15% from previous study. A CNR threshold of 5 is a heuristic, not a clinical sensitivity or diagnosis.
- Uniform activity per scan; isotope-dependent half-life evolution and positron branching fractions omitted, so V6 is not implemented. Range is calibrated to water; real material dependence and beta Fermi function omitted. No dead time, prompt gamma, crystal penetration, full scatter/random corrections, clinical patient motion or measured scanner calibration. SSRB approximates oblique LORs.
- All 29 existing numerical tests and 4 Week 12 checks passed in Node v22.16.0 again after interface edits (engine/recon unchanged). Static ID inventory after redesign: no missing or duplicate IDs. JavaScript syntax checks passed. Live browser navigation was blocked by the execution environment, so actual rendering, performance, mobile device, console and updated Pages URL remain to be verified. This is an explicit submission limitation, not a pass.

## Validation at a glance

| Validation | Measured | Target | Status |
|---|---|---|---|
| Annihilation energy closure, 20,000 events | 2.27 × 10⁻¹³ keV | < 10⁻⁹ keV | PASS |
| Annihilation momentum closure, 20,000 events | 7.53 × 10⁻¹⁴ keV/c | < 10⁻⁹ keV/c | PASS |
| Non-collinearity FWHM | 0.499° | 0.50 ± 0.05° | PASS |
| Water transmission, 10 cm | 0.3826 | 0.3829 ± 0.005 | PASS |
| True-pair efficiency scaling | 0.25341 | 0.25 ± 0.02 | PASS |
| FBP point source at 5 cm | (4.999, −0.005) cm | within one pixel | PASS |
| Euler-Cromer stopping convergence | p ≈ 1.000 | first order for this ODE | PASS |
| Force-free relative energy and momentum error | 0 / 0 | round-off | PASS |
| Scatter-only speed drift, 1000 steps | 4.44 × 10⁻¹⁶ | < 10⁻¹² | PASS |
| Combined stopping/scatter extreme stress | positive ΔK up to 0.01847 normalized units | non-increasing K | LIMITATION |
| All existing automated checks | 29 + 4 passed | all pass | PASS |

