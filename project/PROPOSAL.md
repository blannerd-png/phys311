A1- Title & Pitch
Title: See the Innerworkings of a PET Scanner: Photons and All
Pitch: Users of the website will be able to see a radioactive tracer inside a cross section slice of a body that emits positrons which annihilate,produce gamma rays that are detected by a ring of detectors, and ultimately give information that is used to create an image.

A2- The physics:
1. State every force and constraint (w/ equations)
There are not a lot of forces involved in this simulation, but there are a lot of physics concepts that act as constraints.

Forces:
Positron Stopping (which happens through material interactions). There are a lot of different equations (with different assumptions) that you can use for stopping power that they teach us in our classes. I would probably use for stopping force F= -b*m*v-hat/v^2 where b is a stopping coefficient that represents the more complicated formula of how it interacts with certain matter almost treating stopping more like drag for simplicity. The force is proportional to 1/v^2 which comes form a very simplified frome of the Bethe block stopping power formula for charged particles. m is mass and v-hat is the unit vector that points in the direction of motion. v is the speed of the positron. It's negative because stopping acts in the direction opposite to the travelling direction of the positron.

Contraints: 
Radioactive decay: It uses poisson statistics bc it's commonly known that the decay process fits the requirements of poisson. The simulation will use delta t is approximately equal to the -ln(U)/A where A is a constant activity, and U is a random number uniformly distributed between 0 and 1. Positron kinetic energy is sampled from the allowed β⁺ shape N(E) ∝ p·E·(E₀ − E)². Which is an equation I found on the internet.
Annihilation: the two gamma rays
Annihilation (conservation of energy and momentum): When a positron encounters an electron, they annihilate and produce two gamma-ray photons, each with approximately 511 keV of energy. Ideally, the photons travel in opposite directions to conserve momentum. However, the particles can have some momentum before annihilation, causing a small angular deviation. I want to include this because it is a big part of understanding an actual PET Scanner vs and ideal one with assumptions made such as the photons always travel exactly in 180 degrees. The simulation uses a Lorentz transformation to account for this motion and model realistic photon directions, which affects PET image resolution. They are boosted to the lab frame with E = √((1022 keV)² + (pc)²) and β = pc/E, using a pair momentum σ_pc = 1.9 keV. This gives about 0.5° FWHM non-collinearity.
Attenutation of Photons: survival will be calculated at P = exp(−∫μ dl) which is very common. Then based on the different tissue options I select, I will use online databases to find their linear attenutation coefficents because when you do the integral in the above equation for a uniform material, it simplifies to e^-(ux).
Compton Scattering:Scattered photon energy follows (E'=E/[1+(E/511\text{ keV})(1-\cos\theta)]), with theta drawn from the Klein–Nishina cross-section.
Detection and Coincidence:Arrival time is t=d/c plus Gaussian jitter (CTR 400 ps). Two hits form a  coincidence if (t_1-t_2<tau=4ns) and both energies fall inside the 425–650 keV window. Randoms follow R=2\tau*Si*Sj
The new thing: the relativistic electron-positron annihilation (when they interact they annihilate producting the gamma rays) This results in a two-body decay whose solution can be found using a Lorentz transformation> Lab 10 only has newtonian forces and classical mechanics collisions. I also adjust the conservation of momentum in collisions from lab 9 to be relatavistic.
For the Integrator, I am going to use euler-cromer for the positron to model the energy dissipation. I think because energy dissapates so quickly because of the stopping force, doing velocity verlet will be a waste of computational energy. For the photons, I am going to treat them as Monte Carlo rays because they travel in a straight line so no need for integration. 
For units, the body and ring will be cm. Positron tracks will be mm. Energy will be in kev (mainly bc the 511 kev gammas needed for classic photopeak). TIme will be nanoseconds. Timing resolution should be cm/ns.
#A3
Must:
- Main simulation runs with at least one body part (most likely torso bc easiest geometry) and at least one point source works. There needs to be an obvious response to the tracer and an image formed.
- It needs to be properly linked and active on the github pages. It needs to work on browsers including on phones.
- The validation tests V1-V5 should pass.
Should:
- I want the half life timer/slider shown for each isotope so that you can see tracers with a short half life fade during a scan.
- For each isotope I want to see the branching decays (specifically the fraction for positron since that impacts PET the most)
- Naturally, I'll want an indepth read me and hopefully a good report on the validation tests proving they actually passed. I'll probably want a summary of hte physics and units/scales as well on there.
Could"
- Adding extra body parts and extra isotope options
- Possibly prompt gammas
- I think it would be cool to see average detector dead time
- I'd like to see a threshold or noise on the spectra
- If extra time, I want the ability to make a custom isotope by th euser (with limitations)

# A4: Validation Tests
(AI was used to help generate some of these ideas/ refine them)
• V1, annihilation conservation: over 20,000 annihilations, |E₁ + E₂ − E_pair| < 10⁻⁹ keV and |p₁ + p₂ − p_pair| < 10⁻⁹ keV/c.
• V2, non-collinearity: over 20,000 pairs, the FWHM of the deviation from 180° is 0.50° ± 0.05°, matching the measured 0.47–0.54° in water and tissue.
• V3, Beer–Lambert: with Compton scattering off, the fraction of 511 keV photons that cross 10 cm of water is e^(−0.96) = 0.3829 ± 0.005.
• V4, positron range: the mean range in water is within ±5% of the published values: 0.57 mm (F-18), 1.02 mm (C-11), 2.69 mm (Ga-68) and 5.33 mm (Rb-82).
• V5, switch-off test (conservative reduction):
    ◦ With the stopping force off, scattering alone keeps the speed fixed: |v − v₀|/v₀ < 10⁻¹² after 1,000 steps.
    ◦ With every blur off (positron range, non-collinearity, attenuation, scatter), a pair at rest gives exactly 511 keV photons at 180° (to 10⁻¹²), and a point source at 5 cm reconstructs to within 1 pixel of its true position.
• V6, half-life (SHOULD tier): for Rb-82, the counts recorded in the second 76 s of a scan are 0.50 ± 0.03 times those in the first 76 s (one half-life).
# A6 Biggest Risk and Fall back
The thing most likely to sink this project is the frame rate on a low-end laptop, old phone, or Chromebook once fast acquisition (4,000 decays per frame) and MLEM or TOF reconstruction run inside the same frame, and my fallback is to cap acquisition at 2,000 decays per frame (default 1,000) and keep only filtered and simple backprojection live, with MLEM and TOF run once from a "Reconstruct" button. I know this from on accidently trying to load this on a chromebook at work to show someone and the simulation did not perform well at all.
# A6 Timeline
Week11- Proposal + risk spike: frame-budget benchmark in project/spike/, run on a low-end laptop, findings in FINDINGS.md
Week12-MUST tier complete and deployed: core simulation live on GitHub Pages with the speed cap and the Reconstruct button, V1–V5 passing
Week13- SHOULD tier: half-life, B+ branching and the Cu-64 preset, V6 passing, validation report and README
Week 14- Finishishing touches, polishing, spelling, writeup, presentation, and final check to make sure it meets requirements
# A7 Audience
For aspiring medical physicist like myself who learn better with visuals and activities who struggled to fully visualize the process of how a PET machine worked with the current online resources: after two minutes they will understand that a PET image is built from straight lines between pairs of 511 keV photons, and that positron travel, absorption in tissue and scattered photons are what blur it.