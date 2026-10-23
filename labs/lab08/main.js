
import { Vec2 } from "./vec2.js";
import { Body, World, Gravity, Spring, Euler, EulerCromer, VelocityVerlet } from "./engine.js";

// Canvas setup
const canvas = document.getElementById("sim");
const ctx = canvas.getContext("2d");

const graph = document.getElementById("energyGraph");
const gctx = graph.getContext("2d");

let energyHistory = [];

const el = id => document.getElementById(id);

// Part A: Vec2 self-test
function checkVec2() {
    const a = new Vec2(3, 4);
    const b = new Vec2(1, 2);

    console.log("Addition:", a.add(b));       // (4, 6)
    console.log("Subtraction:", a.sub(b));    // (2, 2)
    console.log("Multiplication:", a.mul(2)); // (6, 8)
    console.log("Dot product:", a.dot(b));    // 11
    console.log("Length:", a.length());       // 5
    console.log("Length squared:", a.lengthSq()); // 25
    console.log("Normalized:", a.normalized());   // (0.6, 0.8)
}
checkVec2();

// Camera: convert physics coordinates to pixels
class Camera {
    constructor(canvas, scale = 20, originX = 35, originY = canvas.height - 25) {
        this.canvas = canvas;
        this.scale = scale;
        this.originX = originX;
        this.originY = originY;
    }

    toScreen(v) {
        return {
            x: this.originX + v.x * this.scale,
            y: this.originY - v.y * this.scale
        };
    }

    toWorld(x, y) {
        return new Vec2(
            (x - this.originX) / this.scale,
            (this.originY - y) / this.scale
        );
    }
}
const camera = new Camera(canvas);

// Part B: Build simulation using the Lab 7 engine
function makeWorld() {
    const method = el("integrator").value;
    const integrator = method === "euler-cromer" ? new EulerCromer()
                     : method === "euler" ? new Euler()
                     : new VelocityVerlet();

    const w = new World(integrator);

    if (el("scene").value === "spring") {
        const b = w.add(new Body({
            mass: 1,
            pos: new Vec2(2, 0),
            vel: new Vec2(0, 0),
            radius: 0.3
        }));
        w.addForce(new Spring(b, new Vec2(0, 0), 8, 0));
    } else {
        const angle = 50 * Math.PI / 180;
        w.add(new Body({
            mass: 1,
            pos: new Vec2(0, 0),
            vel: new Vec2(20 * Math.cos(angle), 20 * Math.sin(angle)),
            radius: 0.3
        }));
        w.addForce(new Gravity());
    }

    w.primeAccelerations();
    return w;
}

let world;
let trail = [];
let paused = true;
let accumulator = 0;
let lastTime = null;
let lag = 0;
let staticScene = false;

function reset() {
    world = makeWorld();
    trail = [world.bodies[0].pos.clone()];
    accumulator = 0;
    lastTime = null;
    paused = true;
    staticScene = false;
    el("pause").textContent = "Pause";
    /*added for energy graphing*/
    energyHistory = [];
}
reset();

// Advance simulation and save trail
function update(dt) {
    const b = world.bodies[0];

    if (el("scene").value === "projectile" &&
        b.pos.y < 0 && world.time > 0) return;

    world.step(dt);
    /*added for energy graphing*/
    
    energyHistory.push({
        t: world.time,
        ke: world.kineticEnergy(),
        pe: world.potentialEnergy(),
        total: world.totalEnergy()
    });

    trail.push(b.pos.clone());
    if (trail.length > 200) trail.shift();
}

// Part A and B: Draw axes, projectile, trail, and HUD
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const origin = camera.toScreen(new Vec2(0, 0));

    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";

    // Ground and vertical axis
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(canvas.width, origin.y);
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, canvas.height);
    ctx.stroke();

    // Tick marks, every 1 meter for Part A
    const spacing = staticScene ? 1 : 5;

    for (let x = 0; x <= 45; x += spacing) {
        const p = camera.toScreen(new Vec2(x, 0));
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 5);
        ctx.lineTo(p.x, p.y + 5);
        ctx.stroke();
        ctx.fillText(x, p.x, p.y - 10);
    }

    for (let y = 0; y <= 25; y += spacing) {
        const p = camera.toScreen(new Vec2(0, y));
        ctx.beginPath();
        ctx.moveTo(p.x - 5, p.y);
        ctx.lineTo(p.x + 5, p.y);
        ctx.stroke();
        ctx.fillText(y, p.x + 10, p.y);
    }

    // Part A: Static circle at (2, 3), radius 0.3 m
    if (staticScene) {
        const p = camera.toScreen(new Vec2(2, 3));
        ctx.fillStyle = "#ff8200";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.3 * camera.scale, 0, 2 * Math.PI);
        ctx.fill();
        return;
    }

    // Fading trajectory
    for (let i = 0; i < trail.length; i++) {
        const p = camera.toScreen(trail[i]);
        ctx.fillStyle = `rgba(255,130,0,${(i + 1) / trail.length})`;
        ctx.fillRect(p.x, p.y, 3, 3);
    }

    // Current position
    const b = world.bodies[0];
    const p = camera.toScreen(b.pos);

    ctx.fillStyle = "#ff8200";
    ctx.beginPath();
    ctx.arc(p.x, p.y, b.radius * camera.scale, 0, 2 * Math.PI);
    ctx.fill();

    // Energy and motion display
    const values = [
        `t = ${world.time.toFixed(3)} s`,
        `x = ${b.pos.x.toFixed(3)} m`,
        `y = ${b.pos.y.toFixed(3)} m`,
        `|v| = ${b.vel.length().toFixed(3)} m/s`,
        `KE = ${world.kineticEnergy().toFixed(3)} J`,
        `PE = ${world.potentialEnergy().toFixed(3)} J`,
        `E_total = ${world.totalEnergy().toFixed(3)} J`
    ];

    ctx.fillStyle = "white";
    values.forEach((v, i) => {
        ctx.fillText(v, canvas.width - 220, 30 + i * 22);
    });
}

/* Energy plotting*/

function drawEnergyGraph() {
    const w = graph.width;
    const h = graph.height;

    gctx.clearRect(0, 0, w, h);

    if (energyHistory.length === 0) return;

    const left = 55;
    const right = w - 20;
    const top = 30;
    const bottom = h - 35;

    const maxTime = Math.max(1, energyHistory.at(-1).t);
    const energies = energyHistory.flatMap(p => [p.ke, p.pe, p.total]);
    const minE = Math.min(0, ...energies);
    const maxE = Math.max(1, ...energies);
    const range = maxE - minE || 1;

    // Axes
    gctx.strokeStyle = "black";
    gctx.beginPath();
    gctx.moveTo(left, top);
    gctx.lineTo(left, bottom);
    gctx.lineTo(right, bottom);
    gctx.stroke();

    gctx.fillStyle = "black";
    gctx.font = "14px Arial";
    gctx.fillText("Energy (J)", 10, 18);
    gctx.fillText("Time (s)", w / 2, h - 5);

    function plot(key, color) {
        gctx.strokeStyle = color;
        gctx.lineWidth = 2;
        gctx.beginPath();

        energyHistory.forEach((p, i) => {
            const x = left + p.t / maxTime * (right - left);
            const y = bottom - (p[key] - minE) / range * (bottom - top);

            if (i === 0) gctx.moveTo(x, y);
            else gctx.lineTo(x, y);
        });

        gctx.stroke();
    }

    plot("ke", "#ff8200");
    plot("pe", "#0088cc");
    plot("total", "#008844");

    // Legend
    gctx.fillStyle = "#ff8200";
    gctx.fillText("KE", 90, 20);

    gctx.fillStyle = "#0088cc";
    gctx.fillText("PE", 145, 20);

    gctx.fillStyle = "#008844";
    gctx.fillText("Total", 200, 20);
}

// Part B: Fixed-timestep accumulator
const MAX_FRAME = 0.25;

function loop(timestamp) {
    if (lastTime === null) lastTime = timestamp;

    const frameTime = Math.min(
        (timestamp - lastTime) / 1000 + lag,
        MAX_FRAME
    );

    lastTime = timestamp;
    lag = 0;

    if (!paused && !staticScene) {
        if (el("fixed").checked) {
            const DT = 1 / Number(el("dt").value);
            accumulator += frameTime;

            while (accumulator >= DT) {
                update(DT);
                accumulator -= DT;
            }
        } else {
            // Part C2: Variable timestep
            if (frameTime > 0) update(frameTime);
        }
    }

    render();
    drawEnergyGraph();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Part C1: Run 1200 steps without rendering
function runHeadless() {
    const results = {};

    for (const method of ["euler-cromer", "verlet"]) {
        const integrator = method === "euler-cromer"
            ? new EulerCromer()
            : new VelocityVerlet();

        const w = new World(integrator);
        const angle = 50 * Math.PI / 180;

        w.add(new Body({
            mass: 1,
            pos: new Vec2(0, 0),
            vel: new Vec2(20 * Math.cos(angle), 20 * Math.sin(angle))
        }));
        w.addForce(new Gravity());
        w.primeAccelerations();

        for (let i = 0; i < 1200; i++) {
            w.step(1 / 120);
        }

        const b = w.bodies[0];

        results[method] = {
            x: b.pos.x,
            y: b.pos.y,
            vx: b.vel.x,
            vy: b.vel.y,
            E_total: w.totalEnergy()
        };
    }

    console.table(results);
    el("log").textContent = JSON.stringify(results, null, 2);
}

// Controls
el("start").onclick = () => {
    paused = false;
    lastTime = null;
    el("pause").textContent = "Pause";
};
el("pause").onclick = () => {
    paused = !paused;
    el("pause").textContent = paused ? "Resume" : "Pause";
};

el("reset").onclick = reset;
el("integrator").onchange = reset;
el("scene").onchange = reset;
el("dt").onchange = reset;
el("fixed").onchange = reset;

el("lag").onclick = () => { lag = 0.3; };
el("static").onclick = () => {
    staticScene = !staticScene;
    if (!staticScene) reset();
};
el("validate").onclick = runHeadless;
