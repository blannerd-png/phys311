// Seeded random numbers so every acquisition can be reproduced exactly (same idea as scenes.js rng).
export function rng(seed = 12345) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal sample (Box–Muller).
export function gaussian(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

// Exponential free path with the given rate (e.g. attenuation coefficient mu in 1/cm).
export function exponential(rand, rate) {
  return -Math.log(1 - rand()) / rate;
}
