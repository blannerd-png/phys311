# PHYS 311 — Lab 10 Write-up

## A1. Coordinate-correct pointer input
`input.js` implements `eventToWorld(event, canvas, camera)`. The browser pointer coordinates are adjusted for the canvas bounding rectangle and CSS-to-drawing-buffer ratio before calling `camera.toWorld(px, py)`. The camera reverses the screen y-axis to make world y increase upward. The canvas displays a cursor crosshair and continuous (x, y) position readout.

**Screenshot to add before submitting:** Capture the canvas/crosshair and visible cursor-coordinate HUD at a corner. Check all four corners against the viewport bounds; after a resize, repeat this check. The code has the conversion, but the screenshots and manual corner verification still need to be completed.

## A2. Controls
Pause suspends updates but rendering continues. Single-step sets the paused state and calls `stepPhysics()` **exactly once**, advancing time by `DT = 1/120 s`; it does not depend on an animation frame. Reset rebuilds the reproducible initial scene and re-baselines energy E0. Speed multiplies the time accumulator (0.25–2×) rather than changing DT. The integrator selector switches among Euler-Cromer, Velocity Verlet and forward Euler.

## A3. Parameter stability
Four physics inputs are available: restitution (0–1), gravity (0–5), quadratic drag (0–1), and effective spring stiffness (10–180). The labels and values update while dragging. All range values are parsed with `parseFloat()` at the UI boundary. At maximum mouse-spring stiffness, the approximate undamped explicit-step condition is

`DT < 2 / sqrt(k) = 2 / sqrt(180) ≈ 0.149 s`

because the mouse-spring acceleration coefficient is `k` (`F = m k Δx`); our `DT ≈ 0.00833 s` is below the limit. The bounded range also limits violent excursions. This is a rough spring-stability screen, not a mathematical guarantee of stability under arbitrary collisions and damping.

## B1. Dragging versus teleporting
Grab mode applies a damped spring force `F = m k (target − position) − m c v` each physics step. This preserves the body in the usual collision solver and naturally gives it release velocity. Slingshot mode starts a body at the press position and sets its launch velocity proportional to the pullback vector; a dashed trajectory preview appears before release.

**Why setting body.pos directly would break the physics:** (1) teleporting can move a ball through a collision boundary in one frame, bypassing physically meaningful contact resolution; (2) the new position does not come from integrating velocity/force, so the release velocity and displayed energy no longer describe the observed motion. **Manual comparison observation to add:** Try temporary position assignment in a local copy of the simulation, note what actually happened, and revert it before submission. These two mechanisms are predictions from the code; they are not represented here as an experiment already performed.

## B2. Visuals that reveal physics
1. **Motion trails with fading transparency** trace recent paths and reveal orbit shapes and how deflections accumulate after collisions.
2. **Velocity vectors** show direction and relative speed that are difficult to infer from still positions.
3. **Force vectors** show where net acceleration is driven by gravity or a spring rather than where a body simply happens to move.
4. **Collision flashes** highlight contact locations and help link deflections to specific collisions.
5. **Live energy chart** makes energy loss or drift visually obvious during parameter changes or inelastic collisions.

Each visual can be independently toggled with an HTML checkbox.

## B3. Responsive and accessible
The drawing buffer is resized with `devicePixelRatio` (capped at 2 for performance), the camera is updated after resizing, pointer events support touch and mouse, and every form control has an associated label. All panel controls can be operated through Tab and standard keyboard interactions, and keyboard shortcuts are available outside editable form controls. The canvas includes fallback text and an accessible label. Color-coded velocity/force effects have separate text descriptions and toggle names.

**Manual checks still needed:** Perform and report an unplugged-mouse keyboard test; test touch input and inspect the public page from a phone and laptop. Do not claim these tests passed until performed.

## C. Focused learning experience
**Purpose statement:** Explore how collisions, springs, and gravity change motion and mechanical energy. Apply a force or launch a ball, then compare the motion against live energy and momentum diagnostics.

**Physics from at least two prior weeks/blocks:** numerical time integration and timestep stability; Newtonian multi-body dynamics and conservation of energy and momentum.

**Quantitative validation:** 20 bodies, no walls/no forces, 60 simulated seconds at 120 steps per second (7,200 total steps). These results were computed by running `npm test` using the supplied Lab 09 engine plus the added Lab 10 modules.

| Test | Initial energy | Final energy | Energy change | Magnitude of momentum-vector change |
|---|---:|---:|---:|---:|
| Elastic, e=1.0 | 12.775000 J | 12.775000 J | 0.00000% | 1.8310×10⁻¹⁵ |
| Inelastic, e=0.8 | 12.775000 J | 10.692810 J | −16.29894% | 9.9301×10⁻¹⁶ |

Momentum is conserved in both wall-free tests to floating-point precision; the inelastic test loses mechanical energy. Note that these numerical units are those of the model (kg, m, s); arbitrary forces and masses in other scenes use normalized units.

## Robustness log
The following automated source-level tests passed: module imports, seeded reset, all three integrators, time increment, drag-force direction, body selection, trajectory construction, and 60-second elastic/inelastic conservation. `node --check` passed on project JavaScript modules.

**Manual robustness checks still to perform and record:** max all sliders, quickly switch scenes, click reset repeatedly, drag into walls at high speed, switch integrators during motion, resize while running, verify the Console remains clean, and test in an incognito browser window and on a phone. Check that no `NaN` or freeze appears, then record observations and any fixes. A graphical browser test was attempted in the creation environment, but navigation was blocked by its browser policy, so it is *not* listed as passed.

## Submission checklist
- [ ] Push complete `labs/lab10/` folder to GitHub (keep exact folder names).
- [ ] Verify live GitHub Pages URL on laptop, mobile, and private/incognito window.
- [ ] Capture A1 cursor-coordinate screenshot, verify four corners.
- [ ] Do teleport-drag comparison and write your observed result.
- [ ] Conduct unplugged-mouse and stress tests and record actual outcomes.
- [ ] Submit this write-up and live link via Canvas.
- [ ] Post Gallery Walk description and request for feedback.
- [ ] Complete two evidence-based peer reviews.
