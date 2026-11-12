# PET scanner: can it find the tumor?

PHYS 311 final project. A Monte Carlo PET scanner in the browser (plain ES modules, no libraries), built on the
Lab 8–10 engine. The question it answers, from Prof. Breinig's email: **what minimum time resolution and detection
efficiency does a detector need to detect a 3D tumor?** It then extends that answer with time of flight, 3D coverage
(more rings, bed stepping) and Compton scatter.

## Scope: MUST / SHOULD / COULD

| | What the email asked | What is implemented | Where |
|---|---|---|---|
| **MUST** | 3D tumor with many more decays than its surroundings | Spherical tumor (default r = 1 cm, uptake 5 : 1) in a 22 cm × 24 cm water cylinder; emission density ∝ tracer concentration | `engine/phantom.js` |
| **MUST** | Gamma rays do not scatter, travel in straight lines | Photons are straight rays at c. Attenuation (optional, on by default) only removes photons along the line (Beer–Lambert); it never deflects them | `engine/photon.js` |
| **MUST** | Detectors = given time resolution + detection efficiency | Each photon reaching a crystal is detected with probability ε. Each detection is time-stamped with Gaussian jitter so two stamps differ with the chosen coincidence time resolution (CTR). The coincidence window follows the CTR: τ = 2·r_FOV/c + 2·CTR | `engine/scanner.js` |
| **MUST** | Minimum resolution and efficiency to detect the tumor | Image reconstruction + tumor contrast-to-noise ratio (CNR), Rose criterion CNR ≥ 5, swept over ε and CTR | `recon/`, `study.mjs` |
| SHOULD | Better time resolution → better spatial resolution | Time of flight (TOF): Δt places each event along its line with σ = c·σ_t/2. TOF backprojection and TOF list-mode MLEM | `recon/reconstruction.js` |
| SHOULD | 3D detection: more detectors or moving the gurney in steps | Ring stack (1–48 rings), 2D/septa/3D ring-pair acceptance, 1–4 bed positions, coronal view | `engine/scanner.js`, `render/` |
| COULD | Probability that a gamma ray scatters | Compton scatter (Klein–Nishina, Woodcock tracking) with an energy window | `engine/photon.js` |

**Not included (deliberately):** detector dead time, depth-of-interaction / crystal penetration, randoms and scatter
correction, detector normalisation, a realistic anatomy, and clinical scan lengths (see *Limitations*).

## Physics model (decay → image)

1. **Decay.** An emission point is drawn with probability ∝ tracer concentration × volume (cylinders along z and spheres).
2. **Positron range (classical, Lab 9 engine).** The positron is a `Body` integrated by `World` + `EulerCromer`, with a
   Bethe-like stopping force (∝ 1/v²) and a multiple-scattering force. Mean ranges are calibrated to published values
   (F-18 0.57 mm … Rb-82 5.3 mm). The 2D track is placed in a randomly oriented plane in 3D.
3. **Annihilation.** Exact two-photon kinematics: back-to-back 511 keV photons in the pair's rest frame, Lorentz-boosted
   by the residual momentum (σ = 1.9 keV/c per component), which gives the measured ≈0.5° non-collinearity.
4. **Photon transport.** Straight lines to the detector cylinder (R = 40 cm). With attenuation on, a photon survives with
   probability exp(−∫μ dl). The line integral is computed exactly through every cylinder and sphere. Photons that leave
   through the ends of the ring stack are lost.
5. **Detector.** 24 rings × 512 crystals (≈4.9 mm × 5 mm), 12 cm axial field of view. A photon is detected with
   probability ε, so a pair is recorded with probability ε². The energy is blurred by the energy resolution, and only
   425–650 keV is accepted (this only matters when scatter is on). The time stamp is t = t_flight + σ·g with
   σ = CTR/(2.355·√2).
6. **Coincidence sorting.** A window of width τ opens on each single. Exactly two singles in the window form a prompt.
   Prompts are labelled *true*, *scatter* or *random* (two different decays). Three or more singles count as a *multiple*
   and are discarded. LORs outside the 14 cm FOV radius or with a too-large ring difference are rejected.
7. **Reconstruction.** Single-slice rebinning (SSRB) assigns each line to the slice at its axial midpoint. Each slice is
   then reconstructed with filtered backprojection, sinogram or list-mode MLEM, or TOF. Attenuation correction uses the
   phantom's μ-map (the "CT" of PET/CT).
8. **Detectability.** On a 1 cm slab through the tumor centre:
   CNR = (tumor ROI mean − mean of ≈30 background ROIs) / (standard deviation of the background ROI means).
   The background ROIs have the same size as the tumor ROI and lie on three rings around the body centre. Detected ⇔ CNR ≥ 5 (Rose).

## Results (`npm run study`, full tables in `results/summary.md`)

Scan: 50 MBq in the phantom, 2 × 10⁷ decays (0.4 s of acquisition), 3 random seeds. MUST reconstruction: non-TOF
list-mode MLEM, 6 iterations, 6 mm smoothing. The study uses *common random numbers*: one simulation with a perfect
detector, where a detector with efficiency ε keeps the photons with u < ε and a detector with resolution CTR re-stamps
their times. All grid points therefore see the same decays.

**MUST: minimum detector**

| CTR | window | randoms (ε = 1) | minimum ε for CNR ≥ 5 |
|---|---|---|---|
| 0.25 – 1 ns | 1.4 – 2.9 ns | 4 – 8 % | ≈ 0.35 |
| 2 – 4 ns | 4.9 – 8.9 ns | 13 – 21 % | ≈ 0.40 |
| 8 ns | 17 ns | 33 % | 0.47 |
| 16 ns | 33 ns | 49 % | 0.64 |
| 32 ns | 65 ns | 66 % | not detectable even at ε = 1 |

* **Efficiency** sets the number of recorded pairs (∝ ε²), so the noise ∝ 1/ε and CNR grows roughly ∝ ε.
  Below ε ≈ 0.3 the tumor is lost in the noise.
* **Time resolution** (without TOF) only enters through the coincidence window. The randoms rate is 2τ·S₁·S₂, so a
  poorer CTR means a wider window and more randoms. Up to ≈ 4 ns this costs little. Beyond that, the randoms add noise
  and lower the contrast (contrast 1.68 → 0.42 from 0.25 → 32 ns at ε = 1), and the wide window loses trues to multiples
  (134 k → 60 k). So the *minimum detector* is roughly **ε ≈ 0.4 per photon with a time resolution of a few ns**.
* **Scaling.** CNR ∝ √(recorded pairs) ∝ ε·√(scan time), so ε_min ∝ 1/√(scan time) at fixed activity. The randoms
  fraction depends on activity × window, not on scan length. A clinical scan lasts minutes rather than 0.4 s, so this 2 cm
  tumor would be found with a much worse detector. Smaller or fainter tumors (sliders in the app) move the threshold back up.

**SHOULD: time of flight** (ε = 0.5). The same events are reconstructed with and without TOF. The CNR gain is ×1.5 at
100 ps, ×1.2 at 400 ps and ×1.04 at 2 ns. It follows the √(D/Δx) trend (Δx = c·CTR/2) but stays below that ideal, as
expected for a small (22 cm) body and a fixed number of MLEM iterations.

**SHOULD: 3D detection.** A tumor 9 cm along the patient lies outside a single bed's 12 cm axial FOV and is never seen.
Two bed positions (CNR 6.0) or three (CNR 8.1) in the *same total time* find it. Three beds do better because the tumor
sits in the middle of one bed's FOV, where 3D sensitivity is highest. At the centre, accepting all ring differences (3D)
instead of |Δring| ≤ 3 collects 6.4× more events (CNR 12.0 vs 1.7).

**COULD: scatter** (ε = 0.8, 10⁷ decays). With the 425 keV threshold, 28 % of the accepted pairs are scattered. They are
mostly small-angle scatters close to the true line, so the contrast barely changes (1.37 → 1.45, within noise). Opening
the window to 250 keV accepts large-angle scatter (39 %), which halves the contrast (0.68) and the CNR (4.5).

Figures: `results/must_cnr_vs_efficiency.png`, `must_detectability_map.png`, `must_min_efficiency.png`, `should_tof.png`
(made by `python3 plot_results.py`).

## Running it

```bash
python3 -m http.server 8000      # ES modules need a web server; then open http://localhost:8000
npm test                         # 29 physics / detector / reconstruction checks (~15 s)
npm run study                    # the detectability study (~15 min; or: node study.mjs --quick)
python3 plot_results.py          # figures from results/*.csv
```

In the app, the **"Is the tumor detected?"** panel re-measures the CNR every few seconds. Try lowering the efficiency,
making the time resolution worse, moving the tumor to z = 9 cm and adding bed positions, or switching on scatter.
Keys: Space pause · `.` step · R clear · −/= speed · [ ] change slice.

## Files

```
index.html, style.css, main.js, ui.js, input.js   page, controls, pointer → world coordinates
engine/   vec2, body, world, forces, integrators, collisions, random   Lab 8–10 engine (unchanged)
          phantom.js       3D phantoms (cylinders + spheres), exact μ line integrals
          positron.js      positron range on the Lab 9 Body/World (3D sampling added)
          annihilation.js  3D two-photon kinematics with Lorentz boost
          photon.js        straight-line transport, attenuation, optional Compton scatter
          scanner.js       ring stack, efficiency, timing, energy window, coincidence sorter, beds
recon/    reconstruction.js  SSRB, FBP, MLEM, TOF backprojection, TOF list-mode MLEM, volume
          detectability.js   ROI contrast-to-noise ratio, Rose criterion
render/   camera.js, petRenderer.js (transverse + side views), eventAnimation.js, panels.js, petHud.js
tests.mjs, study.mjs, plot_results.py, results/
```

## Limitations

* The simulated scans are short (≈0.4 s at 50 MBq) because every decay is followed individually. Absolute thresholds
  scale as described above; the trends are the result.
* No randoms or scatter correction, no dead time. At very high singles rates a real scanner also loses counts to
  dead time, which is not modelled.
* SSRB is exact only for direct planes. Oblique lines from points far off-axis are mispositioned slightly in z.
* The CNR has roughly ±15 % statistical uncertainty per grid point (error bars in the figure), and MLEM is non-linear
  at very low counts, so CNR is not exactly ∝ ε below ε ≈ 0.3.
