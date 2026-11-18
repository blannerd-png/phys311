# PHYS 311 — Week 12 submission instructions

The `project/` folder in this ZIP is a complete, static, GitHub Pages-ready PET scanner application. It includes the original physics simulation, numerical results, and the Week 12 instrumentation/documentation.

## 1. Place files in your GitHub class repository

- Unzip this archive.
- Copy/merge the **contents** of its `project/` folder into the `project/` directory inside your existing PHYS 311 repository, retaining the `engine/`, `recon/`, `render/`, `runtime/` and `results/` subfolders.
- Do **not** upload only a flat set of `.js` files. Case-sensitive imports need the exact structure.
- From the project directory, run `npm test` (29 original checks plus four additional Week 12 checks).
- For local interactive testing, run `python -m http.server 8000` from inside `project/`, then visit `http://localhost:8000/`. ES modules need a server.

## 2. Commit and push

From your repository root:

```bash
git add project/
git commit -m "Week 12: PET scanner MUST, fixed-step validation and debug HUD"
git push
```

If the repository already had uncommitted changes, inspect `git status` and make sure you do not accidentally stage or overwrite unrelated work. Do not fabricate older incremental commits for the bonus.

## 3. Enable/check GitHub Pages

On GitHub, open **Settings → Pages**. Configure **Deploy from a branch**, choose the branch that contains `project/` (normally `main`) and the repository **/(root)** folder. If your repository is published from a `docs/` folder, use its existing setup instead.

With a `project/` folder at repository root, the PET scanner URL is typically:

`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/project/`

If your `project/` is inside another directory, the URL must include that directory too. Wait for Pages to show a deployed URL, then open it in a private/incognito window. Check the browser DevTools Console and Network tabs for errors or 404s.

**Important:** This ZIP does not deploy itself. There is no verified live URL yet.

## 4. Live test checklist

- [ ] Site loads with reconstructed-image and detector panels; no console errors
- [ ] Change detector efficiency; the experiment resets and resumes
- [ ] Press D, or visit `?debug=1`; all required debug HUD metrics appear
- [ ] Check conservative test mode: photon efficiency 100%, energy blur 0%, no attenuation/scatter
- [ ] Press R or **Reset scene**; tumor ratio returns to 5, phantom returns to water+tumor, debug turns off
- [ ] Set speed low and compare 30/60/120 FPS behavior under DevTools CPU throttling; compare states after an equal number of simulation ticks
- [ ] Check keyboard focus on buttons and sliders
- [ ] Visit site on a phone if attempting the bonus (take a screenshot)

## 5. Submit the assignment

- Paste your live GitHub Pages URL and upload/paste `project/PROGRESS.md` to **Canvas**.
- Update `[INSERT REAL GITHUB PAGES URL AFTER PUBLISHING]` in `CHECKIN_DRAFT.md` and `BETA_DRAFT.md` with the actual URL, then post in the required Canvas discussions, on time; reply to one peer.
- Submit `JOURNAL_WEEK12.md` after reviewing the journal wording for accuracy and any separate Canvas journal prompt.
- Keep `DECISIONS.md` and `PROGRESS.md` committed in the repository.
- Check Canvas for the exact due date. The uploaded assignment states "End of Week 12" and does not give an absolute calendar date.

## Numerical validation already performed

- Original physics/reconstruction suite: **29/29 passed**.
- Week 12 event-energy and momentum conservation: max absolute errors **2.2737×10⁻¹³ keV** and **7.7536×10⁻¹⁴ keV/c** over 20,000 events; passed.
- Detector true coincidences: `T(0.5)/T(1) = 1170/4617 = 0.25341`, expected `0.25 ± 0.02`; passed.
- Fixed-step test: 30/60/120 render FPS each generated exactly 60 simulation steps per synthetic second; passed.
- Lossless mode numerical check: passed.
- Module integrity: **55 relative imports** resolve; **59 DOM IDs** referenced exist; all JS files syntax-check.

## Honesty note

Browser UI smoke testing could not be completed from the preparation environment because the local headless browser denied local/file navigation. **No real GitHub Pages deployment, Canvas submission, peer response, or mobile verification has been performed by this ZIP.**
