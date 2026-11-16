# Risk spike findings: frame budget

**Risk from A5:** the simulation can't hold 60 fps on a low-end machine when it runs fast acquisition and MLEM together.

## What I tried

I wrote `bench.js`, which times the engine with no rendering. It tests two things on the torso phantom (F-18, all physics on):

1. `scanner.acquire(n)` per frame at 100–4,000 decays per frame.
2. One `recon.reconstruct()` call for each mode, after 20k and 100k events.

`run.mjs` runs it in Node, and `index.html` runs it in a browser. The physics budget is 16.7 ms minus about 6 ms reserved for drawing, which leaves 10.7 ms.

## What happened

Dev machine: 2-core Xeon at 2.1 GHz, Node 22.

| Test | Result |
|---|---|
| Physics, 1,000 decays/frame | 3.1 ms |
| Physics, 2,000 decays/frame | 5.8 ms |
| Physics, 4,000 decays/frame | 12.0 ms (over budget) |
| FBP, 100k events | 15 ms |
| TOF, 100k events | 158 ms (stutter) |
| MLEM, 2 iterations | 87–94 ms (stutter) |

Low-end machine (`index.html`): _fill in after running it on a Chromebook._

The cost per decay is flat at about 3 µs, so physics time grows linearly with speed. The real problem is reconstruction. `main.js` runs MLEM and TOF inside the frame once a second, so even on this machine the animation freezes for 0.1–0.16 s every second. TOF also gets slower as more events come in, because it loops over every event.

## What it means for scope

- The fastest speed setting drops from 4,000 to 2,000 decays per frame. The default becomes 1,000, which leaves room for a machine 3× slower than this one.
- FBP and simple backprojection stay live.
- MLEM and TOF no longer run automatically. They run once when the user clicks a "Reconstruct" button, so a slow image costs one click instead of a stutter every second.
- Nothing moves to COULD. MUST stays as written, plus these two changes.
