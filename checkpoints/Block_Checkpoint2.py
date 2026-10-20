"""Block 2: 4-body spring + gravity scene with elastic collisions.
AI was used for debugging, plotting help and creating of some functions
"""
from pathlib import Path
import sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine import Body, Gravity, Spring, VelocityVerlet, CollisionWorld

OUT = Path(__file__).resolve().parent
world = CollisionWorld(VelocityVerlet(), restitution=1.0)
initial = [
    (1.0, [0.0, 0.0], [1.5, 0.0]),
    (1.3, [1.1, 0.0], [-1.0, 0.0]),
    (0.9, [2.3, 0.0], [0.4, 0.0]),
    (1.2, [3.6, 0.0], [-0.5, 0.0]),
]
for mass, position, velocity in initial:
    world.add_body(Body(mass, position, velocity, radius=0.22))

# Two distinct forces: uniform gravity and three connecting springs.
world.add_force(Gravity(g=1.0))
for i in range(3):
    world.add_force(Spring(i, i + 1, k=2.0, L0=1.2))

world.record('time', lambda w: w.time)
world.record('kinetic', lambda w: w.kinetic_energy())
world.record('potential', lambda w: w.potential_energy())
world.record('total', lambda w: w.total_energy())
world.record('positions', lambda w: np.array([b.r.copy() for b in w.bodies]))
world.record('momentum', lambda w: w.momentum().copy())

history = world.run(dt=0.0005, t_end=4.0)
t = history['time']
E = history['total']
error = (E - E[0]) / max(abs(E[0]), 1e-12)

# Multi-panel figure provides the required alternative to a screen recording.
fig, axs = plt.subplots(2, 2, figsize=(12, 9))
colors = plt.cm.tab10(np.arange(4))
snapshots = [0, np.searchsorted(t, 0.6), np.searchsorted(t, 1.5), len(t)-1]
for n, frame in enumerate(snapshots):
    ax = axs.flat[n]
    p = history['positions'][frame]
    for j in range(4):
        disk = plt.Circle((p[j,0], p[j,1]), 0.22, color=colors[j], alpha=0.8)
        ax.add_patch(disk)
        ax.text(p[j,0], p[j,1], str(j+1), ha='center', va='center', color='white', fontsize=9)
    ax.set_xlim(-2.5, 5.0); ax.set_ylim(-4.8, 1.3)
    ax.set_aspect('equal'); ax.grid(alpha=0.25)
    ax.set_title(f't = {t[frame]:.2f} s')
    ax.set_xlabel('x (m)'); ax.set_ylabel('y (m)')
fig.suptitle('Four interacting bodies: gravity, springs, and elastic collisions')
fig.tight_layout()
fig.savefig(OUT / 'block2_snapshots.png', dpi=160)
plt.close(fig)

fig, ax = plt.subplots(2, 1, figsize=(10, 7), sharex=True)
ax[0].plot(t, history['kinetic'], label='Kinetic')
ax[0].plot(t, history['potential'], label='Potential')
ax[0].plot(t, E, label='Total mechanical energy', linewidth=2)
ax[0].set_ylabel('Energy (J)'); ax[0].legend(); ax[0].grid(alpha=0.3)
ax[1].plot(t, error)
ax[1].set_xlabel('Time (s)'); ax[1].set_ylabel('Relative total energy change')
ax[1].grid(alpha=0.3)
fig.suptitle('Conservation-law validation (elastic impacts; no drag)')
fig.tight_layout()
fig.savefig(OUT / 'block2_validation.png', dpi=160)
plt.close(fig)

checks = np.array(world.collision_checks)
max_dp = np.max(checks[:,0]) if len(checks) else float('nan')
max_dke = np.max(checks[:,1]) if len(checks) else float('nan')
print('Bodies:', len(world.bodies))
print('Forces: gravity + springs')
print('Collisions:', world.collision_count)
print('Maximum |relative total energy change|:', np.max(np.abs(error)))
print('Maximum pair momentum change in collision (kg m/s):', max_dp)
print('Maximum pair KE change in collision (J):', max_dke)
print('Figures saved to:', OUT)
if world.collision_count == 0:
    raise RuntimeError('No collisions occurred: adjust initial conditions.')
