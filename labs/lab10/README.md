# PHYS 311 — Lab 10: Interactive Physics Lab
## 1. The simulation (what is it?)
This is an 'interactive browser' simulation built from the lab09 (and previous) physics engine and simulation body. The main goal of this simulation is to be able to experience the way energy is conserved during collisions. The original N-body orbit and spring-network scenes are also available. A player can drag a ball using a physically modeled damped spring, launch a new ball with a slingshot, and adjust physics parameters while monitoring energy, momentum, and the simulated time with the HUD. To access the website, you just need to copy the provided link or open the index.html through VS code "open with a live server" option.

## 2. Physics concepts
A lot of physics concepts are tested as well as mathematical techniques and how they impact physics simulations. The concepts are: Newton's laws, contact impulses, restitution, spring forces, gravitational attraction, total mechanical energy, and momentum. The techniques are: numerical integration, fixed timesteps, and different integrators (Euler, Euler–Cromer, Velocity Verlet).
The dt step uses a constant DT = 1/120 s. The speed slider changes how fast fixed steps accumulate, not DT.
Pointer dragging is a force that runs during the normal force phase, so collisions can still occur. Slingshot launch speed comes from the pullback distance. The trajectory preview models uniform downward gravity: it intentionally does not model drag, collisions, or N-body forces.

## 3. User/ Controls Information
| Control | Behavior | Keyboard |
|---|---|---|
| Scene | Switch between billiards, N-body gravity, springs | Tab, arrows |
| Pointer mode | Grab a body with a spring, or slingshot a new one | Tab, arrows; pointer/touch to interact with canvas |
| Pause / Resume | Freeze physics, keep drawing | Space, or focused button |
| Step +Δt | Advance exactly one physics step, pauses if needed | . or focused button |
| Reset | Reconstruct the scene from seeded initial conditions | R or focused button |
| Playback speed | 0.25–2× by scaling frame accumulator | −/+ or range slider |
| Integrator | Forward Euler, Euler–Cromer, Velocity Verlet | Tab, arrows |
| Restitution e | 0 to 1 (billiards) | Range slider |
| Gravity | Downward acceleration (billiards/springs), G (N-body) | Range slider |
| Drag | Quadratic damping coefficient | Range slider |
| Spring stiffness | Mouse spring stiffness, plus network stiffness in spring scene | Range slider |
| Show physics | Toggle trails, velocity arrows, force arrows, contact flashes, energy chart | Checkboxes, Space |
| Benchmark | Timed physics and rendering measurements for 20–200 balls | Focus + Enter |

The cursor crosshair and on-screen readout are expressed in **world meters**. The canvas responds to pointer/touch and uses `getBoundingClientRect()` ratios to correct CSS scaling. The canvas scales with the window and device pixel ratio; keyboard-operated **HTML controls** remain accessible independently of pointer manipulation.

## 4. Physics Testing (how I know it's correct)
`npm test` runs the `tests.mjs` automated checks. These assert scene reset reproducibility, 3 integrators, time stepping, spring pull direction, point selection, trajectory generation, and 60-second isolated collision conservation tests.
For the quantitative test: 20 balls, no external forces or walls, 7,200 steps at `DT = 1/120 s`, starting mechanical energy: 12.775 J

| Restitution | E at 60 s | Energy change | Magnitude of momentum-vector change |
|---|---:|---:|---:|
| 1.0 | 12.775000 J | 0.00000% | 1.83×10⁻¹⁵ kg·m/s |
| 0.8 | 10.692810 J | −16.29894% | 9.93×10⁻¹⁶ kg·m/s |

Both tests passed conservation checks: at e=1, total energy stayed constant to floating-point accuracy. At e=.8, energy decreased due to inelastic collisions, while momentum remained conserved. The main billiards scene has walls, so particle-only momentum there need not remain constant. Energy diagnostics can also shift during pointer-driven interactions, damping, or changed parameters.

## 5. Known limitations
- The trajectory preview is a simplified gravity-only prediction, not a full forward solve with drag and contacts, and is not accurate for Newtonian N-body or spring-network scenes
- Grabbing or launching bodies adds externally supplied work/energy, so energy drift is not a strict closed-system conservation test during interaction.
- Collision flashes are a lightweight contact heuristic, limited to scenes with fewer than 110 balls for performance; walls have no flashes.
- Pointer manipulation needs mouse/touch/pen; keyboard navigation covers control panel operations, not moving individual bodies inside the canvas.
- Automated JavaScript tests were run successfully; final browser, phone, and deployed-link testing performed by me before submission.
