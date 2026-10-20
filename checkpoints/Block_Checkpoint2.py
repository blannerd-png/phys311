
''' Brianna Lannerd
    Block 2 Checkpoint
    10/18/2026 '''
"""Block 2 checkpoint: four disks, gravity, springs, and elastic collisions.
AI was used for debugging, plotting help and creating of some functions
"""

#Import required libraries
import sys
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt

# find the folder with engine.py and add it to the path so we can import it
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'labs' / 'lab07' / 'lab07_engine'))
from engine import Body, World, Gravity, Spring, VelocityVerlet

# importing the engine module from the specified path to use its classes and functions for the simulation.
OUT = Path(__file__).resolve().parent


#function to handle collisions between bodies in the world
def handle_collisions(world):
    """Resolve overlaps and elastic disk collisions; report conservation errors."""
    checks = []
    collision_pairs = []

    for i in range(len(world.bodies)):
        for j in range(i + 1, len(world.bodies)):
            a, b = world.bodies[i], world.bodies[j]
            displacement = b.r - a.r
            distance = np.linalg.norm(displacement)
            min_distance = a.radius + b.radius

            if distance == 0 or distance >= min_distance:
                continue

            #equations for elastic collision response and overlap correction
            normal = displacement / distance
            approach_speed = np.dot(b.v - a.v, normal)

            if approach_speed < 0:
                momentum_before = world.momentum().copy()
                kinetic_before = world.kinetic_energy()

                # Impulse for an elastic collision
                impulse = -2.0 * approach_speed / (1.0 / a.m + 1.0 / b.m)
                a.v -= (impulse / a.m) * normal
                b.v += (impulse / b.m) * normal

                #update the checks list with the differences in momentum and kinetic energy before and after the collision
                checks.append((
                    np.linalg.norm(world.momentum() - momentum_before),
                    abs(world.kinetic_energy() - kinetic_before)
                ))
                collision_pairs.append((i, j))

            # Separate disks so they are not stuck inside each other.
            overlap = min_distance - distance
            correction = overlap / (1.0 / a.m + 1.0 / b.m)
            a.r -= (correction / a.m) * normal
            b.r += (correction / b.m) * normal

    return checks, collision_pairs


# 4 bodies and 2 distinct forces (gravity and springs).
world = World(VelocityVerlet())

initial = [
    (1.0, [0.0, 0.0], [1.5, 0.0]),
    (1.3, [1.1, 0.0], [-1.0, 0.0]),
    (0.9, [2.3, 0.0], [0.4, 0.0]),
    (1.2, [3.6, 0.0], [-0.5, 0.0]),
]

#using a loop to add each body to the world with its mass, position, velocity, and radius
for mass, position, velocity in initial:
    world.add_body(Body(mass, position, velocity, radius=0.22))

world.add_force(Gravity(g=1.0))

for i in range(3):
    world.add_force(Spring(i, i + 1, k=2.0, L0=1.2))


# run the simulation and record data for plotting
#set initial parameters for the simulation, including time step and end time
dt = 0.0005
t_end = 4.0

#creating lists to store time, kinetic energy, potential energy, total energy, positions of bodies, and collision checks during the simulation
times, kinetic, potential, total, positions = [], [], [], [], []
collision_checks = []
collision_times = []
collision_events = []

#updating the lists with the current state of the world at each time step, and handling collisions between bodies
for step in range(int(round(t_end / dt)) + 1):
    times.append(world.time)
    kinetic.append(world.kinetic_energy())
    potential.append(world.potential_energy())
    total.append(world.total_energy())
    positions.append(np.array([b.r.copy() for b in world.bodies]))

    if step < int(round(t_end / dt)):
        world.step(dt)
        new_collisions, pairs = handle_collisions(world)

        if new_collisions:
            collision_times.append(world.time)
            for pair in pairs:
                collision_events.append((step + 1, pair))

        collision_checks.extend(new_collisions)

#creating numpy arrays for time, total energy, positions of bodies, and calculating the relative error in total energy over time
t = np.array(times)
E = np.array(total)
positions = np.array(positions)

#calculating the relative error in total energy over time to assess energy conservation in the simulation
relative_error = (E - E[0]) / max(abs(E[0]), 1e-12)


# Figure sequence: four snapshots of the same simulation.
#select snapshots around the first collision so it is easier to see
if collision_events:
    first_frame, first_pair = collision_events[0]

    snapshots = [
        0,
        max(0, first_frame - 40),
        min(len(t) - 1, first_frame),
        min(len(t) - 1, first_frame + 40)
    ]

    snapshot_titles = [
        'Initial Positions',
        'Before Collision',
        'Immediately After Collision',
        'After Collision'
    ]
else:
    first_pair = None
    snapshots = [
        0,
        np.searchsorted(t, 0.6),
        np.searchsorted(t, 1.5),
        len(t) - 1
    ]
    snapshot_titles = [
        'Initial Positions',
        'Time = 0.60 s',
        'Time = 1.50 s',
        'Time = 4.00 s'
    ]

fig, axs = plt.subplots(2, 2, figsize=(12, 9))
colors = plt.cm.tab10(np.arange(4))

#looping through the selected snapshots to plot the positions of the four disks at different time points in the simulation
for n, frame in enumerate(snapshots):
    ax = axs.flat[n]
    p = positions[frame]

    for j in range(4):
        # Highlight the two bodies involved in the first collision
        if first_pair is not None and j in first_pair and n > 0:
            edge_color = 'red'
            line_width = 2.5
        else:
            edge_color = 'black'
            line_width = 0.5

        ax.add_patch(plt.Circle(
            (p[j, 0], p[j, 1]),
            0.22,
            color=colors[j],
            alpha=0.8,
            ec=edge_color,
            lw=line_width
        ))

        ax.text(
            p[j, 0], p[j, 1], str(j + 1),
            ha='center', va='center', color='white'
        )

    # Zoom in so the collision is more visible
    ax.set_xlim(min(p[:, 0]) - 0.8, max(p[:, 0]) + 0.8)
    ax.set_ylim(min(p[:, 1]) - 0.8, max(p[:, 1]) + 0.8)
    ax.set_aspect('equal')
    ax.set_title(f'{snapshot_titles[n]}\nTime = {t[frame]:.4f} s')
    ax.set_xlabel('x Position (m)')
    ax.set_ylabel('y Position (m)')
    ax.grid(True, alpha=0.3)

fig.suptitle('Block 2: Four-Body Motion and Collisions')
plt.tight_layout()

#save the four simulation snapshots to the checkpoints folder
plt.savefig(OUT / 'block2_snapshots.png', dpi=150)


#plot kinetic, potential, and total mechanical energy to check conservation
fig2, ax1 = plt.subplots(figsize=(10, 6))

ax1.plot(t, kinetic, label='Kinetic Energy')
ax1.plot(t, potential, label='Potential Energy')
ax1.plot(t, total, label='Total Mechanical Energy', linewidth=2)

# Mark collision times on the energy graph
for collision_time in collision_times:
    ax1.axvline(collision_time, color='gray',
                linestyle='--', alpha=0.5)

ax1.set_xlabel('Time (s)')
ax1.set_ylabel('Energy (J)')
ax1.set_title('Energy Conservation')
ax1.legend()
ax1.grid(True, alpha=0.3)

plt.tight_layout()

#save the energy conservation plot to the checkpoints folder
plt.savefig(OUT / 'block2_validation.png', dpi=150)


# Plot the relative energy error
fig3, ax2 = plt.subplots(figsize=(10, 5))

ax2.plot(t, relative_error * 100)

# Mark collision times on the relative error graph
for collision_time in collision_times:
    ax2.axvline(collision_time, color='gray',
                linestyle='--', alpha=0.5)

ax2.set_xlabel('Time (s)')
ax2.set_ylabel('Relative Energy Error (%)')
ax2.set_title('Relative Total Mechanical Energy Error')
ax2.grid(True, alpha=0.3)

plt.tight_layout()

#save the relative energy error plot to the checkpoints folder
plt.savefig(OUT / 'block2_energy_error.png', dpi=150)


# Print conservation results
print('Block 2 Checkpoint Results')
print('--------------------------')
print('Number of bodies:', len(world.bodies))
print('Number of collisions:', len(collision_checks))
print('Initial total energy:', E[0], 'J')
print('Final total energy:', E[-1], 'J')
print('Maximum relative energy error:',
      np.max(np.abs(relative_error)) * 100, '%')

if collision_checks:
    print('Maximum momentum error during collisions:',
          max(c[0] for c in collision_checks))
    print('Maximum kinetic energy error during collisions:',
          max(c[1] for c in collision_checks))

    print('Collision times (s):', collision_times)
    print('First collision between bodies:',
          first_pair[0] + 1, 'and', first_pair[1] + 1)
else:
    print('No collisions detected.')

#display all three figures
plt.show()

