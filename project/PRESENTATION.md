# Recorded presentation — 5–7 minute script and shot list

Target: 6 minutes. Record the **updated, verified** site, not the archived screenshot. Speak naturally and add captions; check that numerical values and equations are readable. Verify the course's six-section instructions in Canvas if they differ from the outline below.

## 1. Hook and scientific question (0:00–0:45)
“PET scanner: can it find the tumor? Positron emission tomography is an imaging technique that uses radioactive tracers to reveal where activity is concentrated. My project asks how detector efficiency and coincidence timing resolution influence our ability to distinguish a small, high-uptake tumor from its surroundings. This is an educational Monte Carlo scanner, not a clinical diagnostic tool.”

Show the main screen and the quick-start instructions. Explain what the scanner and reconstructed images represent.

## 2. Physics model (0:45–1:45)
“Each decay is sampled from a spatial tracer distribution. The positron travels a short distance and annihilates with an electron. The pair produces approximately two 511 keV photons, almost back-to-back. The detector identifies pairs of hits within a coincidence window and records a line of response. Many such lines form the basis of the reconstruction. Attenuation reduces the survival probability according to exp(−∫μ dl), and finite detector efficiency reduces the probability of recording both photons approximately as ε squared. With time-of-flight, the time difference provides a position estimate along the line, Δx = cΔt/2.”

Show the physics tab, then return to the simulation. Clarify that positron stopping is a calibrated classical approximation and photon rays are analytically transported.

## 3. Demonstration (1:45–2:45)
Start with the default 1 cm radius, 5:1 uptake, 80% efficiency and 400-ish ps timing. Allow acquisition to build. Show the CNR score, threshold 5, and reconstructed image. Reveal the true distribution. Decrease efficiency to 20–30%; explain that a change resets the acquisition and that fair comparisons need similar decay counts. Compare with saved detector-sweep results instead of promising a specific short live result. Open advanced geometry and show the side/coronal view. Explain that timing is smaller-is-better and that a larger axial coverage can make an off-center tumor observable. Mention that the detection metric uses non-TOF MLEM on a tumor slab regardless of selected display algorithm.

## 4. Validation — measured results (2:45–4:15)
Show VALIDATION.md or the numerical output. “I ran 29 physics and reconstruction checks and four additional Week 12 checks; all passed. In 20,000 annihilation events, maximum energy closure was 2.27 × 10⁻¹³ keV against a tolerance of 10⁻⁹ keV. The predicted true-pair efficiency ratio at 50% versus 100% efficiency is 0.25; I measured 0.25341. The predicted transmission through 10 cm of water is 0.3829; I measured 0.3826. I also ran a seven-timestep deterministic stopping convergence test. The measured displacement approached the analytic solution with order approximately one, expected for Euler-Cromer with velocity-dependent stopping. At the finest step, displacement error was about 0.014%. In the force-free conservative limit, energy and momentum stayed constant over 3,600 steps.”

Point out the convergence table and work ledger. “The extreme scatter test did reveal a limitation: simultaneous drag and scattering produced an artificial increase in kinetic energy for very large angular kicks. I reported this rather than claiming universal conservation.”

## 5. Limitations and iteration (4:15–5:15)
“The scanner uses idealized geometry, constant activity and simplified detector interactions. It does not model clinical scan duration, isotope branching, time-dependent half-life, detector dead time or complete randoms/scatter correction. CNR ≥ 5 is a model criterion rather than a diagnosis. The interface originally exposed too many settings at once. The redesigned view focuses on the main experiment; advanced settings and technical plots are still available.”

Insert the actual two peer-review comments and specific changes/declined suggestion from REVIEW-RESPONSE.md. Mention actual phone-test findings, not an unverified claim.

## 6. Conclusion (5:15–6:00)
“The project demonstrates how a physical process becomes a measured medical image, and how detector efficiency and timing affect our ability to recover a tracer distribution. The biggest lesson is that a simulation needs quantitative evidence, not just a visually plausible animation. My code, validation tables and model limitations are available in the repository. Try changing a single parameter and compare how the image and score respond.”

Show README and final URL. Finish recording, upload using the instructor-approved method, enable/check captions, and add the real video link to SHOWCASE.md.
