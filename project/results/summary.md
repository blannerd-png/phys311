# PET tumor detectability study

## MUST: minimum detector performance (non-TOF list-mode MLEM)

Tumor: sphere r = 1 cm, uptake 5:1, at (4, 2, 0) cm in a 22 cm × 24 cm water cylinder; activity 5.0e+7 Bq; 2.0e+7 decays per scan (0.40 s); 3 seed(s). Detected ⇔ CNR ≥ 5.

| CTR (ps) | window (ns) | randoms fraction (ε=1) | CNR per unit ε | minimum ε |
|---|---|---|---|---|
| 250 | 1.43 | 4.1 % | 14.50 | 0.34 |
| 500 | 1.93 | 5.4 % | 13.19 | 0.38 |
| 1000 | 2.93 | 7.9 % | 13.86 | 0.36 |
| 2000 | 4.93 | 12.5 % | 12.56 | 0.40 |
| 4000 | 8.93 | 20.6 % | 12.40 | 0.40 |
| 8000 | 16.93 | 33.0 % | 10.72 | 0.47 |
| 16000 | 32.93 | 49.0 % | 7.82 | 0.64 |
| 32000 | 64.93 | 65.5 % | 4.62 | not detectable |

| efficiency ε | worst CTR that still detects (ps) |
|---|---|
| 0.1 | none |
| 0.2 | none |
| 0.3 | none |
| 0.4 | 2000 |
| 0.5 | 8000 |
| 0.6 | 8000 |
| 0.8 | 16000 |
| 1 | 16000 |

## SHOULD: time of flight (ε = 0.5; same events reconstructed without and with TOF)

| CTR (ps) | Δx = cΔt/2 (cm) | CNR non-TOF | CNR TOF | gain | √(D/Δx) |
|---|---|---|---|---|---|
| 100 | 1.5 | 9.1 | 13.8 | 1.51 | 3.83 |
| 200 | 3.0 | 9.1 | 12.5 | 1.37 | 2.71 |
| 300 | 4.5 | 7.3 | 10.2 | 1.41 | 2.21 |
| 400 | 6.0 | 8.2 | 9.9 | 1.22 | 1.92 |
| 600 | 9.0 | 8.2 | 9.7 | 1.18 | 1.56 |
| 800 | 12.0 | 7.6 | 9.0 | 1.18 | 1.35 |
| 1200 | 18.0 | 7.0 | 7.9 | 1.12 | 1.11 |
| 2000 | 30.0 | 7.9 | 8.2 | 1.04 | 1.00 |

## SHOULD: 3D detection (tumor at z = 9 cm; scanner axial FOV ±6 cm; same total decays)

| case | tumor z | coincidences in 1 cm slab | CNR | detected |
|---|---|---|---|---|
| 1 bed, 2D (septa: ring difference ≤ 3) | 9 | 0 | – | no |
| 1 bed, 3D (all ring differences) | 9 | 0 | – | no |
| 2 beds, 3D (offsets ±5 cm) | 9 | 2544 | 6.0 | yes |
| 3 beds, 3D (offsets 0, ±10 cm) | 9 | 4169 | 8.1 | yes |
| reference: tumor at z = 0, 1 bed, 2D | 0 | 2250 | 1.7 | no |
| reference: tumor at z = 0, 1 bed, 3D | 0 | 14465 | 12.0 | yes |

## COULD: Compton scatter (ε = 0.8, CTR = 400 ps; 1.0e+7 decays per case, because scatter tracking is slower)

| case | scatter fraction | tumor contrast | CNR |
|---|---|---|---|
| no scatter (MUST model) | 0.0 % | 1.37 | 6.3 |
| scatter, 425–650 keV window | 28.3 % | 1.45 | 9.2 |
| scatter, wide 250–650 keV window | 39.1 % | 0.68 | 4.5 |
