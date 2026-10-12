import numpy as np

# Body: stores position, velocity, and forces
class Body:
    def __init__(self, mass, pos, vel, radius=0.1, I=None, fixed=False):
        self.m = mass
        self.r = np.array(pos, dtype=float)
        self.v = np.array(vel, dtype=float)
        self.radius = radius
        self.theta = 0.0
        self.omega = 0.0
        self.I = I if I is not None else 0.5 * mass * radius**2
        self.fixed = fixed
        self.force = np.zeros(2)
        self.torque = 0.0

    def clear_accumulators(self):
        self.force = np.zeros(2)
        self.torque = 0.0


# Part A: Section 1
class Gravity:
    def __init__(self, g=9.81):
        self.g = np.array([0.0, -g])

    def apply(self, world):
        for b in world.bodies:
            if not b.fixed:
                b.force += b.m * self.g

    def potential_energy(self, world):
        return sum(-b.m * self.g[1] * b.r[1] for b in world.bodies if not b.fixed)


class Drag:
    def __init__(self, c):
        self.c = c

    def apply(self, world):
        for b in world.bodies:
            if not b.fixed:
                b.force += -self.c * np.linalg.norm(b.v) * b.v

    def potential_energy(self, world):
        return 0.0


class Spring:
    # Connects two bodies by their indices in world.bodies
    def __init__(self, i, j, k=1.0, L0=0.0):
        self.i, self.j, self.k, self.L0 = i, j, k, L0

    def apply(self, world):
        a, b = world.bodies[self.i], world.bodies[self.j]
        d = b.r - a.r
        L = np.linalg.norm(d)
        if L == 0:
            return
        F = self.k * (L - self.L0) * d / L
        a.force += F
        b.force -= F

    def potential_energy(self, world):
        a, b = world.bodies[self.i], world.bodies[self.j]
        L = np.linalg.norm(b.r - a.r)
        return 0.5 * self.k * (L - self.L0)**2


class NewtonGravity:
    def __init__(self, G=1.0):
        self.G = G

    def apply(self, world):
        for i in range(len(world.bodies)):
            for j in range(i + 1, len(world.bodies)):
                a, b = world.bodies[i], world.bodies[j]
                d = b.r - a.r
                r = np.linalg.norm(d)
                if r == 0:
                    continue
                F = self.G * a.m * b.m * d / r**3
                a.force += F
                b.force -= F

    def potential_energy(self, world):
        U = 0.0
        for i in range(len(world.bodies)):
            for j in range(i + 1, len(world.bodies)):
                a, b = world.bodies[i], world.bodies[j]
                r = np.linalg.norm(b.r - a.r)
                if r > 0:
                    U -= self.G * a.m * b.m / r
        return U


# Integrators from Week 7 lesson
class EulerCromer:
    def step(self, world, dt):
        world.compute_forces()
        for b in world.bodies:
            if b.fixed:
                continue
            b.v += (b.force / b.m) * dt
            b.r += b.v * dt
            b.omega += (b.torque / b.I) * dt
            b.theta += b.omega * dt


class VelocityVerlet:
    def step(self, world, dt):
        world.compute_forces()
        old_a = [b.force.copy() / b.m for b in world.bodies]
        for b, a in zip(world.bodies, old_a):
            if not b.fixed:
                b.r += b.v * dt + 0.5 * a * dt**2
        world.compute_forces()
        for b, a in zip(world.bodies, old_a):
            if not b.fixed:
                b.v += 0.5 * (a + b.force / b.m) * dt


# World: owns the bodies, forces, integrator, and recording
class World:
    def __init__(self, integrator):
        self.bodies = []
        self.forces = []
        self.integrator = integrator
        self.time = 0.0
        self.history = {}
        self.recorders = {}

    def add_body(self, body):
        self.bodies.append(body)

    def add_force(self, force):
        self.forces.append(force)

    def compute_forces(self):
        for b in self.bodies:
            b.clear_accumulators()
        for f in self.forces:
            f.apply(self)

    def step(self, dt):
        self.integrator.step(self, dt)
        self.time += dt

    def kinetic_energy(self):
        return sum(0.5*b.m*np.dot(b.v, b.v) for b in self.bodies)

    def potential_energy(self):
        return sum(f.potential_energy(self) for f in self.forces)

    def total_energy(self):
        return self.kinetic_energy() + self.potential_energy()

    def momentum(self):
        return sum((b.m*b.v for b in self.bodies), np.zeros(2))

#Part A: Section 3
    def record(self, name, fn):
        self.recorders[name] = fn
        self.history[name] = []

    def capture(self):
        for name, fn in self.recorders.items():
            self.history[name].append(fn(self))

    def run(self, dt, t_end):
        self.capture()
        for i in range(int(round(t_end/dt))):
            self.step(dt)
            self.capture()
        return {name: np.array(data) for name, data in self.history.items()}
