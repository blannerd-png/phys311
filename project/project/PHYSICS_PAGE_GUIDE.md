# Simulation Details: The Physics — installation and usage

The project is already updated and ready to run.

## How to add only the new page to an existing project

Copy these four files from the `project/` folder into your existing PET scanner `project/` folder, keeping their exact filenames:

- `index.html` — original simulation plus the new physics page content
- `style.css` — matching dark theme and responsive layout
- `physicsPage.js` — page toggle without losing scanner state
- `ui.js` — ensures keyboard shortcuts act only on the simulation view

The rest of the provided full project is unchanged from the Week 12 snapshot, apart from the README update. If you have made newer changes after this snapshot, merge rather than overwriting them.

## Running

From inside `project/`:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/` in your browser. Use **Simulation Details: The Physics** in the navigation bar to switch to the reference page. A direct link is `http://localhost:8000/#physics`.

`npm test` runs the existing physics and Week 12 validation tests. No new NPM dependencies or external math-rendering libraries are required. It is deployable as a static site on GitHub Pages.

## Covered topics

1. Tracer distribution and the phantom
2. Poisson decay timing and β⁺ energy spectrum
3. Positron stopping force, scattering, range, and Euler–Cromer integration
4. Annihilation, non-collinearity and relativistic energy–momentum conservation
5. Gamma travel and attenuation
6. Optional Klein–Nishina Compton scattering
7. Detection efficiency and energy resolution
8. Coincidence timing, randoms/scatters/multiples and model NECR
9. 3D ring geometry, gurney movement and SSRB
10. Sinograms, FBP, MLEM and attenuation correction
11. Time-of-flight localization and TOF reconstruction
12. Tumor CNR and Rose criterion
13. Numerical methods, limitations and code references
