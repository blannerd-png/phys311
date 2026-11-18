# PHYS 311 — Week 12 build sprint journal draft

In this sprint I focused on ensuring that the PET scanner's central demonstration—recovering a small, high-uptake tumor from coincidence events—has numerical evidence and the diagnostics required by the assignment. The model treats positron annihilation relativistically, transports the 511 keV photons through a simple phantom, simulates detector efficiency and coincidence timing, and reconstructs the lines of response.

The original event loop advanced the Monte Carlo simulation once per rendered frame. I moved the acquisition work behind a fixed 1/60-s accumulator so changes in graphics FPS do not change how many logical physics steps run over a given simulated interval. In a synthetic rate comparison, 30, 60, and 120 render frames per second all generated 60 fixed steps over one second. The guard against an overloaded browser discards backlog, which remains a stated limitation to verify on the live page.

I also added an event-specific conservation HUD. Rather than assuming the live radioactive acquisition has a single conserved mechanical energy, it compares the energy and momentum of each photon pair with its annihilating e⁺e⁻ pair. Across 20,000 simulated annihilations the maximum energy mismatch was 2.2737×10⁻¹³ keV, and the maximum momentum mismatch was 7.7536×10⁻¹⁴ keV/c. The second validation test measured 1170 true coincidences at 50% efficiency and 4617 at 100%, giving 0.25341, consistent with the predicted ε² scaling of 0.25. Both met their stated tolerances.

I created an idealized lossless test configuration to separate annihilation conservation from material attenuation and detector rejection. For user experience, I added a full scene reset separate from clearing acquisition data. The original 29-test suite still passed.

The remaining external requirements are to publish and check the live GitHub Pages URL, test the HUD and conservative mode in a browser, post the check-in and beta links, respond to one classmate, and submit the progress log. I will not claim those steps are complete until I actually perform them.
