"""Make the report figures from the CSV files written by `npm run study`.
Usage:  python3 plot_results.py      (needs numpy + matplotlib; writes results/*.png)"""
import csv
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

R = "results"
ROSE = 5


def read(name):
    with open(f"{R}/{name}.csv") as f:
        rows = list(csv.DictReader(f))
    return [{k: (float(v) if v.replace('.', '', 1).replace('-', '', 1).replace('e', '', 1).isdigit() else v) for k, v in r.items()} for r in rows]


plt.rcParams.update({"font.size": 11, "axes.grid": True, "grid.alpha": 0.3})

# 1. CNR vs efficiency for each timing resolution (MUST).
g = read("must_grid")
effs = sorted({r["efficiency"] for r in g})
ctrs = sorted({r["ctr_ps"] for r in g})
fig, ax = plt.subplots(figsize=(7, 4.6))
cmap = plt.get_cmap("viridis")
for i, c in enumerate(ctrs):
    rr = sorted([r for r in g if r["ctr_ps"] == c], key=lambda r: r["efficiency"])
    ax.errorbar([r["efficiency"] for r in rr], [r["cnr"] for r in rr], yerr=[r["cnr_sd"] for r in rr],
                marker="o", ms=4, capsize=2, color=cmap(i / (len(ctrs) - 1)),
                label=f"{c/1000:g} ns (window {rr[0]['window_ns']:.1f} ns)")
ax.axhline(ROSE, color="crimson", ls="--", lw=1.2)
ax.text(0.11, ROSE + 0.3, "Rose criterion CNR = 5", color="crimson")
ax.set_xlabel("detection efficiency per photon, ε")
ax.set_ylabel("tumor contrast-to-noise ratio")
ax.set_title("MUST: tumor CNR vs detector efficiency and time resolution")
ax.legend(title="coincidence time resolution", fontsize=8, title_fontsize=9, loc="upper left")
fig.tight_layout(); fig.savefig(f"{R}/must_cnr_vs_efficiency.png", dpi=150)

# 2. Detectability map.
Z = np.array([[next(r["cnr"] for r in g if r["efficiency"] == e and r["ctr_ps"] == c) for e in effs] for c in ctrs])
fig, ax = plt.subplots(figsize=(7, 4.6))
im = ax.pcolormesh(np.arange(len(effs) + 1), np.arange(len(ctrs) + 1), Z, cmap="RdYlGn", vmin=0, vmax=2 * ROSE, shading="flat")
for i in range(len(ctrs)):
    for j in range(len(effs)):
        ax.text(j + 0.5, i + 0.5, f"{Z[i, j]:.1f}", ha="center", va="center", fontsize=8)
ax.set_xticks(np.arange(len(effs)) + 0.5, [f"{e:g}" for e in effs])
ax.set_yticks(np.arange(len(ctrs)) + 0.5, [f"{c/1000:g}" for c in ctrs])
ax.set_xlabel("detection efficiency per photon, ε"); ax.set_ylabel("time resolution (ns FWHM)")
ax.set_title("Tumor CNR (green ≥ 5: detected)")
ax.grid(False)
fig.colorbar(im, ax=ax, label="CNR")
fig.tight_layout(); fig.savefig(f"{R}/must_detectability_map.png", dpi=150)

# 3. Minimum efficiency and randoms fraction vs timing resolution.
m = read("must_min_efficiency")
fig, ax = plt.subplots(figsize=(7, 4.2))
x = [r["ctr_ps"] / 1000 for r in m]
ax.semilogx(x, [min(r["min_efficiency_fit"], 1.05) for r in m], "o-", label="minimum ε for CNR ≥ 5")
ax.semilogx(x, [r["random_fraction"] for r in m], "s--", label="randoms fraction of prompts (ε = 1)")
ax.axhline(1, color="gray", lw=0.8)
ax.set_xlabel("coincidence time resolution (ns FWHM)"); ax.set_ylim(0, 1.1)
ax.set_title("Poor timing → wider window → more randoms → better efficiency needed")
ax.legend(); fig.tight_layout(); fig.savefig(f"{R}/must_min_efficiency.png", dpi=150)

# 4. TOF (SHOULD).
t = read("should_tof")
fig, ax = plt.subplots(1, 2, figsize=(10, 4))
x = [r["ctr_ps"] for r in t]
ax[0].plot(x, [r["cnr_nontof"] for r in t], "o-", label="without TOF")
ax[0].plot(x, [r["cnr_tof"] for r in t], "s-", label="with TOF")
ax[0].axhline(ROSE, color="crimson", ls="--", lw=1)
ax[0].set_xlabel("time resolution (ps FWHM)"); ax[0].set_ylabel("tumor CNR"); ax[0].legend(); ax[0].set_title("Same events, two reconstructions")
ax[1].plot(x, [r["gain"] for r in t], "o-", label="measured CNR gain")
ax[1].plot(x, [r["gain_theory_sqrt_D_over_dx"] for r in t], "--", label="√(D/Δx), D = 22 cm")
ax[1].set_xlabel("time resolution (ps FWHM)"); ax[1].set_ylabel("CNR(TOF) / CNR(no TOF)"); ax[1].legend(); ax[1].set_title("Time-of-flight gain")
fig.tight_layout(); fig.savefig(f"{R}/should_tof.png", dpi=150)
print("wrote figures to", R)
