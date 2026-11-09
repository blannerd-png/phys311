// 2D phantoms built from nested circles. Each region has a tracer concentration,
// a 511 keV linear attenuation coefficient mu (1/cm) and a relative density.
// Later regions override earlier ones where they overlap.
export const MATERIALS = {
  air:    {mu: 0,     density: 0.0012, label: 'Air'},
  water:  {mu: 0.096, density: 1.0,    label: 'Soft tissue / water'},
  lung:   {mu: 0.029, density: 0.30,   label: 'Lung'},
  bone:   {mu: 0.172, density: 1.85,   label: 'Bone'}
};

export class Phantom {
  constructor(name, regions) {
    this.name = name;
    this.regions = regions.map(r => ({movable: false, ...r, ...materialOf(r)}));
    this.prepare();
  }
  get body() {return this.regions[0];}

  prepare() {
    const R = this.regions;
    for (let i = 0; i < R.length; i++) {
      R[i].parent = -1;
      for (let j = i - 1; j >= 0; j--) if (inside(R[j], R[i].x, R[i].y)) {R[i].parent = j; break;}
      R[i].parentMu = R[i].parent >= 0 ? R[R[i].parent].mu : 0;
      R[i].weight = R[i].conc * Math.PI * R[i].r * R[i].r;
    }
    // Only regions whose material differs from their surroundings matter for attenuation.
    this.muRegions = R.filter(r => r.mu !== r.parentMu);
    this.muMax = Math.max(0, ...R.map(r => r.mu));
    this.totalWeight = R.reduce((s, r) => s + r.weight, 0);
    this.maxConc = Math.max(1e-9, ...R.map(r => r.conc));
  }

  regionAt(x, y) {
    for (let i = this.regions.length - 1; i >= 0; i--) if (inside(this.regions[i], x, y)) return i;
    return -1;
  }
  muAt(x, y) {
    for (let i = this.muRegions.length - 1; i >= 0; i--) if (inside(this.muRegions[i], x, y)) return this.muRegions[i].mu;
    return 0;
  }
  densityAt(x, y) {const i = this.regionAt(x, y); return i < 0 ? MATERIALS.air.density : this.regions[i].density;}
  concAt(x, y) {const i = this.regionAt(x, y); return i < 0 ? 0 : this.regions[i].conc;}

  // Sample an emission point (cm) with probability proportional to tracer concentration.
  sampleEmission(rand) {
    if (this.totalWeight <= 0) return null;
    // Pick a region by conc × area, then a uniform point in it; reject points owned by an
    // inner region and start over. This gives density exactly equal to the local concentration.
    for (let tries = 0; tries < 500; tries++) {
      let pick = rand() * this.totalWeight, i = 0;
      while (i < this.regions.length - 1 && pick >= this.regions[i].weight) {pick -= this.regions[i].weight; i++;}
      const reg = this.regions[i];
      const r = reg.r * Math.sqrt(rand()), a = 2 * Math.PI * rand();
      const x = reg.x + r * Math.cos(a), y = reg.y + r * Math.sin(a);
      if (this.regionAt(x, y) === i) return [x, y];
    }
    return [this.body.x, this.body.y];
  }

  // Line integral of mu along the line {p : p·(cos φ, sin φ) = s}. Exact for circles.
  lineIntegralMu(phi, s) {
    const c = Math.cos(phi), sn = Math.sin(phi);
    let total = 0;
    for (const r of this.muRegions) {
      const d = r.x * c + r.y * sn - s;
      if (Math.abs(d) < r.r) total += (r.mu - r.parentMu) * 2 * Math.sqrt(r.r * r.r - d * d);
    }
    return total;
  }
}

function inside(r, x, y) {const dx = x - r.x, dy = y - r.y; return dx * dx + dy * dy <= r.r * r.r;}
function materialOf(r) {const m = MATERIALS[r.material || 'water']; return {mu: m.mu, density: m.density};}

export const PHANTOMS = {
  torso: {label: 'Torso slice with two lesions', make: () => new Phantom('torso', [
    {name: 'Body', x: 0, y: 0, r: 11, material: 'water', conc: 1},
    {name: 'Left lung', x: -5, y: 2.2, r: 3.6, material: 'lung', conc: 0.25},
    {name: 'Right lung', x: 5, y: 2.2, r: 3.6, material: 'lung', conc: 0.25},
    {name: 'Spine', x: 0, y: -7, r: 1.4, material: 'bone', conc: 0.4},
    {name: 'Heart wall', x: 0.8, y: -1.2, r: 2.3, material: 'water', conc: 4},
    {name: 'Heart cavity', x: 0.8, y: -1.2, r: 1.4, material: 'water', conc: 1.2},
    {name: 'Lung lesion', x: -5.5, y: 3.2, r: 0.7, material: 'water', conc: 10, movable: true},
    {name: 'Liver lesion', x: 5.5, y: -4.5, r: 1.1, material: 'water', conc: 6, movable: true}
  ])},
  derenzo: {label: 'Resolution rods (Derenzo)', make: makeDerenzo},
  uniform: {label: 'Uniform water cylinder', make: () => new Phantom('uniform', [
    {name: 'Water cylinder', x: 0, y: 0, r: 10, material: 'water', conc: 1}
  ])},
  points: {label: 'Point sources in air', make: () => new Phantom('points', [
    {name: 'Air', x: 0, y: 0, r: 13, material: 'air', conc: 0},
    // Sealed sources: a tiny water bead, so the positron stops in water, as in a real capsule.
    {name: 'Point at centre', x: 0, y: 0, r: 0.05, material: 'water', conc: 1},
    {name: 'Point at 5 cm', x: 5, y: 0, r: 0.05, material: 'water', conc: 1},
    {name: 'Point at 10 cm', x: 10, y: 0, r: 0.05, material: 'water', conc: 1}
  ])}
};

function makeDerenzo() {
  const regions = [{name: 'Water cylinder', x: 0, y: 0, r: 10, material: 'water', conc: 0.05}];
  const diameters = [1.6, 1.2, 1.0, 0.8, 0.6, 0.45];
  diameters.forEach((d, k) => {
    const alpha = Math.PI / 2 + k * Math.PI / 3, spacing = 2 * d;
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    for (let row = 0; row < 20; row++) {
      const t = 1.6 + d / 2 + row * spacing * Math.sin(Math.PI / 3);
      if (t + d / 2 > 9.3) break;
      const half = t * Math.tan(Math.PI / 7.2);   // stay inside a ~50° wedge
      const n = Math.floor((2 * half) / spacing);
      for (let j = 0; j <= n; j++) {
        const u = -n * spacing / 2 + j * spacing;
        regions.push({name: `Rod ${d} cm`, x: t * ca - u * sa, y: t * sa + u * ca, r: d / 2, material: 'water', conc: 10});
      }
    }
  });
  return new Phantom('derenzo', regions);
}
