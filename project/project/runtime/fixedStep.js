// Browser-independent fixed-step accumulator. The PET acquisition advances in identical
// discrete ticks; rendering can run at any refresh rate. A backlog cap prevents UI freezes.
export const FIXED_DT = 1 / 60;
export class FixedStepAccumulator {
  constructor(step = FIXED_DT, maxSteps = 5) {
    this.step = step; this.maxSteps = maxSteps; this.reset();
  }
  reset() { this.remainder = 0; this.steps = 0; this.droppedSeconds = 0; }
  advance(elapsed, onStep) {
    // A huge background-tab pause must not trigger minutes of catch-up work.
    const capped = Math.min(Math.max(0, elapsed), 0.25);
    this.droppedSeconds += Math.max(0, elapsed - capped);
    this.remainder += capped;
    let executed = 0;
    while (this.remainder + 1e-12 >= this.step && executed < this.maxSteps) {
      onStep(this.step);
      this.remainder = Math.max(0, this.remainder - this.step);
      this.steps++; executed++;
    }
    if (this.remainder + 1e-12 >= this.step) {
      // A heavily overloaded browser runs more slowly, not with a different timestep.
      const ignored = Math.floor((this.remainder + 1e-12) / this.step);
      this.droppedSeconds += ignored * this.step;
      this.remainder = Math.max(0, this.remainder - ignored * this.step);
    }
    return executed;
  }
}
