# PHYS 311 — Lab 09: Multi-Body Browser Simulation

## Overview

Lab 09 is an interactive JavaScript physics simulation with three scenes built using the same physics engine. The simulation runs in a browser and displays information about motion, conservation of energy, momentum, and performance.

## Scenes

### Scene 1 — Billiards / Ball Pit

Multiple balls move inside a box and collide with one another and the walls. This scene demonstrates collision detection, momentum transfer, and the effect of the coefficient of restitution (`e`). With `e = 1`, collisions are elastic; with `e < 1`, kinetic energy is lost during collisions. The number of balls can also be changed to observe performance with more bodies.

### Scene 2 — Gravitational N-Body

Five bodies interact through their mutual gravitational attraction. Their paths are shown using motion trails. The simulation uses softened Newtonian gravity and Velocity Verlet integration to model orbital motion and examine changes in total mechanical energy.

### Scene 3 — Spring Network

Two moving masses are connected by springs, with one spring attached to a fixed anchor. Gravity and spring forces cause the masses to oscillate. This scene demonstrates Hooke's law and energy exchange between kinetic, gravitational potential, and spring potential energy.

## How to Run and Switch Scenes

1. Open `labs/lab09/` in Visual Studio Code.
2. Open `index.html` with **Live Server** to launch the simulation in a browser.
3. Use the **scene selector** on the page to choose **Billiards / Ball Pit**, **Gravitational N-Body**, or **Spring Network**.
4. Select another scene at any time to start that simulation.

## Controls

- **Scene selector:** Switches between the three physics simulations.
- **Integrator selector:** Switches between **Euler-Cromer** and **Velocity Verlet** integration to compare numerical behavior.
- **Coefficient of restitution (`e`):** Changes how elastic collisions are in the billiards scene. `e = 1` is perfectly elastic, while smaller values produce inelastic collisions.
- **Body count:** Changes the number of balls in the billiards scene for visual and performance comparisons.
- **Show incorrect separating-guard behavior:** Demonstrates the collision jitter bug in Scene 1. Turn it off to restore the correct collision behavior.
- **Benchmark all sizes:** Runs performance comparisons for **20, 50, 100, and 200 bodies**.

Some controls apply only to the billiards scene.

## On-Screen Diagnostics (HUD)

The heads-up display shows simulation time, number of bodies, total mechanical energy, fractional energy drift, momentum magnitude, frames per second (FPS), and physics/rendering times. These measurements help evaluate the simulation's physical accuracy and computational performance.

## Project Files

- `index.html` — Browser page for the simulation.
- `style.css` — Page styling.
- `main.js` — Simulation loop and user interface.
- `scenes.js` — Configuration of the three scenes.
- `engine/` — Physics bodies, forces, integrators, collisions, and world updates.
- `render/` — Camera, canvas renderer, and HUD.
- `tests.mjs` — Automated physics and conservation checks (run with `node tests.mjs`).

The physics engine is shared across all three scenes, allowing different systems to be modeled without changing the engine code for each scene.
