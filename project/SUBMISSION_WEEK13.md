# Week 13 — final submission checklist

## Install first (do not overwrite your only copy)
1. Back up the current `project` folder outside the repository. Extract `PET_Final_Week13.zip` and replace the repository's `project/` with the supplied complete folder (not a second nested `project/project`). The original input ZIP remains unchanged. The old `project_archive/` was excluded from the final package to avoid confusion; it remains in your original ZIP.
2. Open a terminal in the new `project/` directory. Run `npm test` and `npm run convergence` if Node is installed. Measured results from this revision are already included.
3. Run `py -3 -m http.server 8000` and open `http://localhost:8000`. Confirm the default simulation runs, pause/resume and clear/reset work, keyboard arrows adjust sliders, the Physics tab returns without losing data, and each disclosure opens and shows its original controls/plots. Try D for diagnostics and conservative mode on/off. Check F12 Console for errors. The assistant's browser environment blocked navigation; these are required local checks, not completed tests.
4. If the original page had a custom setting not in your ZIP, preserve it after checking the change against this package. Commit and push from the repository root:

```bash
git status
git add project
git commit -m "Finalize Week 13 PET scanner validation and simplify UI"
git push
```

5. Open https://blannerd-png.github.io/phys311/project/#simulation in a fresh/private browser; confirm the new quick-start design and a working reconstruction. Do not submit until verified.

## November 29 — primary final submission
- [x] `convergence.js`, seven measured timesteps, raw numerical results.
- [x] `VALIDATION.md`, B1–B4 including integrator comparison, stress case, analytic comparison, ledger and limitations.
- [x] `README.md`, existing physics equations, architecture, local instructions, added validation summary and visitor guide.
- [x] `DECISIONS.md`, reasoned SHOULD/COULD deferrals and subtraction pass.
- [x] On-page controls/help, quick start, scale bar, keyboard labels, native collapsible panels (source completed, browser verification pending).
- [ ] Real desktop browser console test and updated live link.
- [ ] Real phone check (open the live page on a phone; test sliders, pause/reset, tab switching, advanced settings and no horizontal clipping). Record device/browser, date, specific problem or success in VALIDATION.md. A mobile emulator is not the real-device check.
- [ ] Submit live URL + VALIDATION.md + README by November 29 in Canvas.

## December 2 — peer review
- [ ] Review both assigned projects using PEER_REVIEWS.md; post actual findings to discussion.
- [ ] Fill REVIEW-RESPONSE.md with actual received feedback and decisions.

## December 4 — showcase, presentation and reflection
- [ ] Record 5–7 minutes using PRESENTATION.md; ensure captioning and actual link.
- [ ] Capture a clean 1200×675 screenshot of updated simulation.
- [ ] Fill SHOWCASE.md, submit to Showcase or privately per course policy.
- [ ] Watch and comment on two peers' presentations.
- [ ] Personalize REFLECTION.md, fill actual peer paragraph, check word count and remove draft annotations; submit both in repository and Canvas.
- [ ] Push final files and verify updated live page.

The course overview and submission checklist use slightly different point allocations; follow the Canvas grade rubric. No external posting, real phone testing, recording, or personal peer feedback has been completed by the assistant.
