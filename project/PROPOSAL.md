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