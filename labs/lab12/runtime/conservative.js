// Diagnostic ideal-detector / energy-conservation limit for PET.
// Here there are no Newtonian rigid-body contacts, so coefficient of restitution e is N/A.
// Switch off all stochastic energy loss and detector rejection to isolate annihilation
// four-momentum closure. Geometry still limits whether photons reach the finite ring stack.
export function conservativeConfig(config) {
  return {...config,
    positronRange: false, nonCollinearity: false,
    attenuation: false, scatter: false, efficiency: 1,
    energyResolution: 0, windowLow: 0, windowHigh: 700
  };
}
