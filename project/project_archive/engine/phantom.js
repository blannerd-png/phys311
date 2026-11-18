// 3D phantoms built from nested cylinders (axis along z, the scanner axis) and spheres.
// Each region has a tracer concentration, a 511 keV linear attenuation coefficient mu (1/cm)
// and a relative density. Later regions override earlier ones where they overlap.
// Lengths in cm. The patient lies along z; x is left–right, y is anterior–posterior.
export const MATERIALS = {
  air:    {mu: 0,     density: 0.0012, label: 'Air'},
  water:  {mu: 0.096, density: 1.0,    label: 'Soft tissue / water'},
  lung:   {mu: 0.029, density: 0.30,   label: 'Lung'},
  bone:   {mu: 0.172, density: 1.85,   label: 'Bone'}
};

export class Phantom {
  constructor(name, regions) {
    this.name = name;
    const body = regions[0];
    this.regions = regions.map(r => {
      const reg = {movable: false, shape: 'cylinder', ...r, ...materialOf(r)};
      if (reg.shape === 'cylinder') {reg.z0 ??= body.z0 ?? -10; reg.z1 ??= body.z1 ?? 10; reg.z = (reg.z0 + reg.z1) / 2;}
      else reg.z ??= 0;
      return reg;
    });
    this.viewZ = 0;          // the transverse slice used by the 2D helpers (drawing, editing)
    this.prepare();
  }
  get body() {return this.regions[0];}
  // The region whose detectability is measured (the tumor), if any.
  get target() {return this.regions.find(r => r.target) ?? null;}

  prepare() {
    const R = this.regions;
    for (let i = 0; i < R.length; i++) {
      const r = R[i];
      r.parent = -1;
      for (let j = i - 1; j >= 0; j--) if (inside(R[j], r.x, r.y, r.z)) {r.parent = j; break;}
      r.parentMu = r.parent >= 0 ? R[r.parent].mu : 0;
      r.volume = r.shape === 'sphere' ? 4 / 3 * Math.PI * r.r ** 3 : Math.PI * r.r * r.r * (r.z1 - r.z0);
      r.weight = r.conc * r.volume;
    }
    // Only regions whose material differs from their surroundings matter for attenuation.
    this.muRegions = R.filter(r => r.mu !== r.parentMu);
    this.muMax = Math.max(0, ...R.map(r => r.mu));
    this.totalWeight = R.reduce((s, r) => s + r.weight, 0);
    this.maxConc = Math.max(1e-9, ...R.map(r => r.conc));
    const b = this.body;
    this.zMin = b.shape === 'sphere' ? b.z - b.r : b.z0;
    this.zMax = b.shape === 'sphere' ? b.z + b.r : b.z1;
  }

  regionAt(x, y, z = this.viewZ) {
    for (let i = this.regions.length - 1; i >= 0; i--) if (inside(this.regions[i], x, y, z)) return i;
    return -1;
  }
  muAt(x, y, z = this.viewZ) {
    for (let i = this.muRegions.length - 1; i >= 0; i--) if (inside(this.muRegions[i], x, y, z)) return this.muRegions[i].mu;
    return 0;
  }
  densityAt(x, y, z = this.viewZ) {const i = this.regionAt(x, y, z); return i < 0 ? MATERIALS.air.density : this.regions[i].density;}
  concAt(x, y, z = this.viewZ) {const i = this.regionAt(x, y, z); return i < 0 ? 0 : this.regions[i].conc;}

  // Circles where the regions cut the transverse plane at height z (for drawing).
  crossSection(z = this.viewZ) {
    const out = [];
    this.regions.forEach((r, i) => {
      let rr = 0;
      if (r.shape === 'sphere') {const d = z - r.z; if (Math.abs(d) < r.r) rr = Math.sqrt(r.r * r.r - d * d);}
      else if (z >= r.z0 && z <= r.z1) rr = r.r;
      if (rr > 0) out.push({index: i, region: r, x: r.x, y: r.y, r: rr, conc: r.conc, mu: r.mu, name: r.name});
    });
    return out;
  }

  // Sample an emission point [x, y, z] (cm) with probability proportional to tracer concentration.
  sampleEmission(rand) {
    if (this.totalWeight <= 0) return null;
    // Pick a region by conc × volume, then a uniform point in it; reject points owned by an
    // inner region and start over. This gives density exactly equal to the local concentration.
    for (let tries = 0; tries < 500; tries++) {
      let pick = rand() * this.totalWeight, i = 0;
      while (i < this.regions.length - 1 && pick >= this.regions[i].weight) {pick -= this.regions[i].weight; i++;}
      const reg = this.regions[i];
      let x, y, z;
      if (reg.shape === 'sphere') {
        do {x = 2 * rand() - 1; y = 2 * rand() - 1; z = 2 * rand() - 1;} while (x * x + y * y + z * z > 1);
        x = reg.x + reg.r * x; y = reg.y + reg.r * y; z = reg.z + reg.r * z;
      } else {
        const r = reg.r * Math.sqrt(rand()), a = 2 * Math.PI * rand();
        x = reg.x + r * Math.cos(a); y = reg.y + r * Math.sin(a); z = reg.z0 + (reg.z1 - reg.z0) * rand();
      }
      if (this.regionAt(x, y, z) === i) return [x, y, z];
    }
    return [this.body.x, this.body.y, this.body.z];
  }

  // ∫ mu dl along the straight segment p0 → p1 (3D). Exact for cylinders and spheres.
  muLineIntegral(p0, p1) {
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    let total = 0;
    for (const r of this.muRegions) {
      const [t0, t1] = segmentInterval(r, p0, d);
      if (t1 > t0) total += (r.mu - r.parentMu) * (t1 - t0) * L;
    }
    return total;
  }

  // Line integral of mu along the in-slice line {p : p·(cos φ, sin φ) = s} at height z
  // (used for attenuation correction of direct-plane sinograms).
  lineIntegralMu(phi, s, z = this.viewZ) {
    const c = Math.cos(phi), sn = Math.sin(phi), h = 200;
    return this.muLineIntegral([s * c + h * sn, s * sn - h * c, z], [s * c - h * sn, s * sn + h * c, z]);
  }
}

function inside(r, x, y, z) {
  const dx = x - r.x, dy = y - r.y;
  if (r.shape === 'sphere') {const dz = z - r.z; return dx * dx + dy * dy + dz * dz <= r.r * r.r;}
  return dx * dx + dy * dy <= r.r * r.r && z >= r.z0 && z <= r.z1;
}

// Parameter interval [t0, t1] ⊂ [0, 1] of p0 + t·d that lies inside region r.
function segmentInterval(r, p0, d) {
  let lo = 0, hi = 1;
  const ox = p0[0] - r.x, oy = p0[1] - r.y;
  if (r.shape === 'sphere') {
    const oz = p0[2] - r.z, a = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    const b = ox * d[0] + oy * d[1] + oz * d[2], c = ox * ox + oy * oy + oz * oz - r.r * r.r;
    const disc = b * b - a * c;
    if (disc <= 0 || a === 0) return [0, 0];
    const q = Math.sqrt(disc);
    return [Math.max(lo, (-b - q) / a), Math.min(hi, (-b + q) / a)];
  }
  const a = d[0] * d[0] + d[1] * d[1], b = ox * d[0] + oy * d[1], c = ox * ox + oy * oy - r.r * r.r;
  if (a < 1e-18) {if (c > 0) return [0, 0];}
  else {
    const disc = b * b - a * c;
    if (disc <= 0) return [0, 0];
    const q = Math.sqrt(disc);
    lo = Math.max(lo, (-b - q) / a); hi = Math.min(hi, (-b + q) / a);
  }
  if (Math.abs(d[2]) < 1e-18) {if (p0[2] < r.z0 || p0[2] > r.z1) return [0, 0];}
  else {
    let ta = (r.z0 - p0[2]) / d[2], tb = (r.z1 - p0[2]) / d[2];
    if (ta > tb) [ta, tb] = [tb, ta];
    lo = Math.max(lo, ta); hi = Math.min(hi, tb);
  }
  return [lo, hi];
}

function materialOf(r) {const m = MATERIALS[r.material || 'water']; return {mu: m.mu, density: m.density};}

// The MUST scenario: a water cylinder (the patient) with one spherical tumor that takes up
// `ratio` times more tracer per volume than the surrounding tissue.
export function makeTumorPhantom({ratio = 5, radius = 1, x = 4, y = 2, z = 0} = {}) {
  return new Phantom('tumor', [
    {name: 'Body', x: 0, y: 0, r: 11, z0: -12, z1: 12, material: 'water', conc: 1},
    {name: 'Tumor', shape: 'sphere', x, y, z, r: radius, material: 'water', conc: ratio, movable: true, target: true}
  ]);
}

export const PHANTOMS = {
  tumor: {label: 'Water cylinder with one spherical tumor', make: makeTumorPhantom},
  torso: {label: 'Torso section with two lesions', make: () => new Phantom('torso', [
    {name: 'Body', x: 0, y: 0, r: 11, z0: -12, z1: 12, material: 'water', conc: 1},
    {name: 'Left lung', x: -5, y: 2.2, r: 3.6, z0: -9, z1: 10, material: 'lung', conc: 0.25},
    {name: 'Right lung', x: 5, y: 2.2, r: 3.6, z0: -9, z1: 10, material: 'lung', conc: 0.25},
    {name: 'Spine', x: 0, y: -7, r: 1.4, material: 'bone', conc: 0.4},
    {name: 'Heart wall', shape: 'sphere', x: 0.8, y: -1.2, z: 2, r: 3.2, material: 'water', conc: 4},
    {name: 'Heart cavity', shape: 'sphere', x: 0.8, y: -1.2, z: 2, r: 2.0, material: 'water', conc: 1.2},
    {name: 'Lung lesion', shape: 'sphere', x: -5.5, y: 3.2, z: 0, r: 0.8, material: 'water', conc: 8, movable: true, target: true},
    {name: 'Liver lesion', shape: 'sphere', x: 5.5, y: -4.5, z: -5, r: 1.1, material: 'water', conc: 6, movable: true}
  ])},
  derenzo: {label: 'Resolution rods (Derenzo)', make: makeDerenzo},
  uniform: {label: 'Uniform water cylinder', make: () => new Phantom('uniform', [
    {name: 'Water cylinder', x: 0, y: 0, r: 10, z0: -12, z1: 12, material: 'water', conc: 1}
  ])},
  points: {label: 'Point sources in air', make: () => new Phantom('points', [
    {name: 'Air', x: 0, y: 0, r: 13, z0: -12, z1: 12, material: 'air', conc: 0},
    // Sealed sources: a tiny water bead, so the positron stops in water, as in a real capsule.
    {name: 'Point at centre', shape: 'sphere', x: 0, y: 0, z: 0, r: 0.05, material: 'water', conc: 1},
    {name: 'Point at 5 cm', shape: 'sphere', x: 5, y: 0, z: 0, r: 0.05, material: 'water', conc: 1},
    {name: 'Point at 10 cm', shape: 'sphere', x: 10, y: 0, z: 0, r: 0.05, material: 'water', conc: 1}
  ])}
};

function makeDerenzo() {
  const regions = [{name: 'Water cylinder', x: 0, y: 0, r: 10, z0: -6, z1: 6, material: 'water', conc: 0.05}];
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
        regions.push({name: `Rod ${d} cm`, x: t * ca - u * sa, y: t * sa + u * ca, r: d / 2, z0: -5, z1: 5, material: 'water', conc: 10});
      }
    }
  });
  return new Phantom('derenzo', regions);
}
