### November 22, 2026 — Verify GitHub Pages deployment

**Decision:** Deploy the completed PET scanner simulation to GitHub Pages and test its functionality on both a PC and an iPhone.

**Reason:** The Week 12 assignment requires a publicly accessible simulation that works outside the local development environment. Testing on multiple devices also helps identify compatibility and performance issues.

**Cost / tradeoff:** Time was dedicated to deployment verification rather than additional physics features. An intermittent HTTP 503 resource-loading error was observed, but refreshing restored the simulation. Final console verification remains important.

### November 22, 2026 — Retain fixed timestep with a performance safeguard

**Decision:** Keep the 1/60-second fixed-timestep accumulator and its limit on catch-up steps under heavy computational loads.

**Reason:** CPU-throttling tests at 4× and 6× slowdown showed that the simulation maintained accurate energy and momentum conservation but experienced reduced frame rates and accumulated backlog.

**Cost / tradeoff:** Under significant computational load, the simulation discards accumulated time to prevent excessive processing and freezing. Although individual physics steps remain fixed, the acquisition may progress more slowly than real time.

### November 22, 2026 — Prioritize PET reconstruction improvements for Week 13

**Decision:** Focus the next development phase on time-of-flight reconstruction, 3D detector coverage and bed stepping, and Compton scatter/energy-window behavior.

**Reason:** The core PET simulation and numerical validation are functioning. These features provide opportunities to investigate how detector performance and photon interactions influence reconstructed image quality and tumor detectability.

**Cost / tradeoff:** The originally proposed SHOULD features involving isotope half-life and positron branching fractions are deferred while reconstruction validation, documentation, and performance improvements take priority.
