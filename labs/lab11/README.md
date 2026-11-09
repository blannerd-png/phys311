# PHYS 311 — PET Scanner: a particle-by-particle physics model

## 1. What it is
An interactive browser simulation of positron emission tomography (PET), built on the Lab 9/10 physics engine. Each tracer decay is followed from start to finish:
1. A positron is emitted and slows down in tissue.
2. It annihilates into two photons.
3. The photons are tracked through the body (they may Compton-scatter or be absorbed) to a 256-crystal detector ring.
4. Pairs of detections are sorted into coincidences, and the coincidences are reconstructed into an image while you watch.

The visitor can switch individual physical effects on and off and see how each one degrades the image. One real decay at a time is replayed in slow motion, with a zoomed view of the positron's millimetre-scale track.

Run it with VS Code "Open with Live Server" (ES modules need a server). Run `npm test` for the automated checks.

## 2. Physics concepts
| Stage | Physics | Where |
|---|---|---|
| Positron emission | β⁺ energy spectrum (allowed shape p·E·(Eₘₐₓ−T)²) | `engine/positron.js` |
| Positron slowing | Newton's 2nd law: a `Body` in a `World` integrated by **Euler–Cromer**, under a Bethe-like stopping force F = −b·v̂/v² and a multiple-scattering force that rotates v by a random angle each step | `engine/positron.js` |
| Annihilation | e⁺e⁻ → 2γ with **exact relativistic energy and momentum conservation**: back-to-back 511 keV photons in the pair's rest frame, Lorentz-boosted by the residual momentum. This gives the ≈0.5° non-collinearity and a ~1 keV Doppler shift | `engine/annihilation.js` |
| Photon transport | Beer–Lambert attenuation, μ(511 keV) = 0.096 cm⁻¹ in water; Woodcock (delta) tracking through tissue, lung and bone | `engine/photon.js` |
| Compton scattering | Klein–Nishina angular distribution; E′ = E / (1 + (E/mc²)(1 − cos θ)) | `engine/photon.js` |
| Detection | Detector efficiency, Gaussian energy resolution ∝ √E, timing jitter, energy window | `engine/scanner.js` |
| Coincidence sorting | Single-window sorter: trues, scatters, randoms (rate ∝ 2τS²), multiples; NECR | `engine/scanner.js` |
| Image reconstruction | Sinogram (Radon transform); simple and ramp-filtered backprojection (FFT); MLEM iterative reconstruction; time-of-flight backprojection; attenuation correction from exact line integrals of μ | `recon/reconstruction.js` |

Topics from earlier blocks: Newton's laws and numerical integration (positron transport using the Lab 9 `World`, `Body` and `EulerCromer`); momentum and energy conservation (annihilation, checked live on the HUD); exponential decay laws (attenuation, Poisson decay times).

### Reuse of the Lab 9/10 code
- `engine/vec2.js`, `body.js`, `world.js`, `integrators.js`, `forces.js`, `collisions.js` are copied **unchanged**.
- `render/camera.js` (world ↔ screen with flipped y) and `input.js` (`eventToWorld` with the bounding-rect correction) are reused unchanged.
- The new forces (`StoppingForce`, `ScatteringForce`) use the same `apply(world)` Force interface as `Gravity`, `Drag` and `Spring`.
- The fixed-step loop, HUD layout, keyboard shortcuts, CSV export and the layering rule follow Lab 10.
- Photons are not Newtonian bodies (massless, constant speed c), so they are modelled as Monte Carlo rays rather than integrated.

## 3. How to use
| Control | Behavior | Keyboard |
|---|---|---|
| Phantom | Torso slice (lungs, spine, heart, two lesions) · Derenzo resolution rods · uniform water cylinder · point sources in air | Tab, arrows |
| Tracer isotope | F-18, C-11, Ga-68, Rb-82: higher positron energy → longer range → blurrier image | Tab, arrows |
| Reconstruction | FBP · simple backprojection · MLEM · time-of-flight backprojection | Tab, arrows |
| Pause / Step / Restart | Freeze acquisition; simulate exactly one decay and replay it; clear all data | Space, `.`, R |
| Add lesion / Remove added | Add a hot lesion at a random spot (torso & uniform) | Focus + Enter |
| Canvas pointer | Drag a dashed lesion; click inside the body to add one | Pointer / touch |
| Physics switches | Positron range, non-collinearity, attenuation, Compton scatter, attenuation correction | Checkboxes |
| Activity | 0.1–200 M decays/s (log scale): watch randoms and multiples grow | Range slider |
| Energy window, energy resolution | Reject scattered photons; see the trade-off with sensitivity | Range sliders |
| Coincidence window τ, CTR | Randoms ∝ τ; TOF blur = c·CTR/2 | Range sliders |
| Acquisition speed | 1 to 4000 decays per frame (1 = follow single events) | −/+ |
| Show | Lines of response, slow-motion replay, zoomed positron track | Checkboxes |
| Download list-mode CSV | Every coincidence: time, crystals, endpoints, Δt, energies, type, true position | Focus + Enter |

Visual encoding (not by colour alone): true LORs are solid lines, scattered LORs dashed, and randoms dotted. Compton vertices are marked ×. The caption under the canvas describes each replayed decay in words.

Things to try:
- **Uniform cylinder.** With attenuation correction off, the centre looks too dark ("cupping"); turn AC on and it flattens.
- **Derenzo rods.** Compare F-18 with Rb-82: the small rods disappear with Rb-82.
- **Torso.** Turn Compton scatter on and off and watch the haze and the scatter fraction. Raise the energy-window lower edge to cut scatter.
- **Activity at maximum.** Randoms take over and NECR stops rising.
- **Time-of-flight mode.** Drop the CTR to 100 ps and the image sharpens with no reconstruction at all.

## 4. How I know it's right
`npm test` runs 21 automated checks (results from the current code):

| Check | Result |
|---|---|
| Annihilation energy conservation, 20,000 pairs | max \|E₁+E₂−E\| = 2.3×10⁻¹³ keV |
| Annihilation momentum conservation | max \|p₁+p₂−p\| = 8.3×10⁻¹⁴ keV/c |
| Non-collinearity FWHM (target ≈ 0.5°) | 0.503° |
| Compton backscatter energy (511/3) | 170.333 keV |
| Klein–Nishina ⟨cos θ⟩, Monte Carlo vs integral | 0.2926 vs 0.2914 |
| Beer–Lambert survival through 10 cm water, exp(−0.96) | 0.3815 vs 0.3829 |
| Positron mean range vs published (F-18 / C-11 / Ga-68 / Rb-82) | 0.567 / 0.997 / 2.588 / 5.422 mm vs 0.57 / 1.02 / 2.69 / 5.33 mm |
| Attenuation line integral, exact vs numeric | 2.09720 vs 2.09717 |
| Coincidence sorter on hand-made singles | 1 true, 1 multiple |
| Randoms per decay when activity ×5 (expect ≈5; multiples remove some) | ×4.30 |
| FBP point-source centroids at 0, 5, 10 cm | within 0.005 cm |
| MLEM count conservation | Σ A·x / Σ y = 1.000000000 |
| TOF backprojection centroid (source at 5 cm) | 4.997 cm |
| Seeded runs reproducible; no DOM in `engine/` or `recon/` | pass |

The live HUD repeats the annihilation conservation check for every decay. The energy spectrum shows the 511 keV photopeak and the Compton continuum below the 341 keV Compton edge, as on a real scanner. The positron-range calibration uses published mean ranges in water (Conti & Eriksson 2016; Cal-Gonzalez et al.). Range scales as 1/density, which reproduces the published ratio of about 3.2× in lung.

Robustness: every slider was set to its extreme and every phantom × isotope × reconstruction combination was cycled. Every button was spammed, lesions were dragged far outside the body (they are clamped), and the window was resized mid-run. None of this produced a NaN, a console error or a frozen frame.

## 5. Known limitations
- **2D only.** Real scanners are 3D. Photons are kept in the slice, so axial escape and out-of-plane scatter are missing. Scatter and random fractions are therefore indicative, not clinical.
- **Positron model.** It is calibrated, not ab initio. The beta spectrum ignores the Fermi function, and range is scaled by the density at the emission point only.
- **Photon physics.** Only Compton scattering (photoelectric absorption is approximated by stopping photons below 20 keV), with no Rayleigh scattering.
- **Detector model.** No dead time, depth-of-interaction or crystal penetration. Each LOR end is placed at a random point across the crystal that fired, which avoids sampling artefacts from fixed crystal centres.
- **No scatter or randoms correction.** They appear as background, on purpose.
- **Not a clinical tool.** Research-grade PET simulation uses toolkits such as GATE or Geant4.
- **Time scales are slowed for display.** A real photon crosses the ring in about 1 ns.
