import "./style.css";
import { createGame, step, WIDTH, HEIGHT, START_LIVES } from "./game.js";

const ROW_COLORS = ["#FF5A3C", "#FF9F1C", "#FFD23F", "#7BE07B", "#3ED1E6"];
const BG_TOP = "#0B1226";
const BG_BOTTOM = "#05070D";
const TEXT = "#E6EDF7";
const MUTED = "#7D8AA3";
const ACCENT = "#3ED1E6";
const WIN = "#7BE07B";
const LOSE = "#FF5A3C";
const SANS = '"Geist", ui-sans-serif, system-ui, sans-serif';
const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';

const TRAIL_LENGTH = 8;
const PARTICLE_LIFE = 0.4;
const SHAKE_TIME = 0.2;
const SHAKE_SIZE = 5;
const FLASH_TIME = 0.25;
const PANEL_FADE = 0.2;
const BEST_KEY = "breakout.best";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const params = new URLSearchParams(location.search);
const layout =
  import.meta.env.DEV && params.has("rows")
    ? { rows: Number(params.get("rows")) || 1, cols: Number(params.get("cols")) || 1 }
    : undefined;

let state = createGame(layout);
let trail = [];
let particles = [];
let shake = 0;
let flash = 0;
let panelTime = 0;
let lastStatus = state.status;
let best = readBest();
let newBest = false;

const keys = new Set();
let launchPressed = false;
let restartPressed = false;

// ---------- sizing ----------

let scale = 1;
let dpr = 1;

function resize() {
  const margin = 32;
  const footer = 72;
  const availW = Math.max(240, window.innerWidth - margin * 2);
  const availH = Math.max(180, window.innerHeight - margin * 2 - footer);
  scale = Math.min(availW / WIDTH, availH / HEIGHT);
  const cssW = Math.floor(WIDTH * scale);
  const cssH = Math.floor(HEIGHT * scale);
  scale = cssW / WIDTH;
  dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
}

window.addEventListener("resize", resize);
resize();

// ---------- input ----------

const KEY_LEFT = new Set(["ArrowLeft", "KeyA"]);
const KEY_RIGHT = new Set(["ArrowRight", "KeyD"]);
const HANDLED = new Set(["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space", "KeyR"]);
const keycaps = new Map(
  [...document.querySelectorAll("kbd[data-key]")].map((el) => [el.dataset.key, el]),
);

window.addEventListener("keydown", (e) => {
  if (!HANDLED.has(e.code) || e.metaKey || e.ctrlKey || e.altKey) return;
  e.preventDefault();
  audio.unlock();
  keycaps.get(e.code)?.classList.add("pressed");
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "Space") launchPressed = true;
  if (e.code === "KeyR") restartPressed = true;
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  keycaps.get(e.code)?.classList.remove("pressed");
});

window.addEventListener("blur", () => {
  keys.clear();
  for (const el of keycaps.values()) el.classList.remove("pressed");
});

canvas.addEventListener("pointerdown", () => canvas.focus());
canvas.focus();

function readInput() {
  const input = {
    left: [...KEY_LEFT].some((k) => keys.has(k)),
    right: [...KEY_RIGHT].some((k) => keys.has(k)),
    launch: launchPressed,
    restart: restartPressed,
  };
  launchPressed = false;
  restartPressed = false;
  return input;
}

// ---------- audio ----------

const audio = (() => {
  let ac = null;
  let master = null;

  function unlock() {
    if (ac) {
      if (ac.state === "suspended") ac.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    master = ac.createGain();
    master.gain.value = 0.18;
    master.connect(ac.destination);
  }

  function tone(freq, { at = 0, length = 0.08, type = "square", to = freq, gain = 1 } = {}) {
    if (!ac) return;
    const t = ac.currentTime + at;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  return {
    unlock,
    paddle: () => tone(330, { length: 0.07, type: "triangle", to: 440, gain: 0.9 }),
    wall: () => tone(220, { length: 0.04, type: "triangle", gain: 0.35 }),
    brick: (row) => tone(880 - row * 70, { length: 0.08, type: "square", to: 1200 - row * 90, gain: 0.5 }),
    lifeLost: () => tone(260, { length: 0.35, type: "sawtooth", to: 70, gain: 0.6 }),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.1, length: 0.16, type: "triangle", gain: 0.8 })),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, { at: 0.25 + i * 0.14, length: 0.2, type: "triangle", gain: 0.7 })),
  };
})();

// ---------- effects ----------

function burst(brick) {
  const color = ROW_COLORS[brick.row % ROW_COLORS.length];
  const count = 12 + Math.floor(Math.random() * 5);
  const cx = brick.x + brick.w / 2;
  const cy = brick.y + brick.h / 2;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 120;
    particles.push({
      x: cx + (Math.random() - 0.5) * brick.w * 0.6,
      y: cy + (Math.random() - 0.5) * brick.h * 0.6,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      gravity: 160,
      size: 1.5 + Math.random() * 2,
      color,
      life: PARTICLE_LIFE,
      age: 0,
    });
  }
}

function rain(bricks) {
  for (const brick of bricks) {
    const color = ROW_COLORS[brick.row % ROW_COLORS.length];
    for (let i = 0; i < 10; i++) {
      const life = 1.4 + Math.random() * 1.2;
      particles.push({
        x: brick.x + Math.random() * brick.w,
        y: brick.y + Math.random() * brick.h,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 + Math.random() * 40,
        gravity: 220,
        size: 1.5 + Math.random() * 2,
        color,
        life,
        age: -Math.random() * 0.6,
        onTop: true,
      });
    }
  }
}

function handleEvents(events) {
  for (const e of events) {
    switch (e.type) {
      case "brick":
        burst(e.brick);
        flash = FLASH_TIME;
        audio.brick(e.brick.row);
        break;
      case "paddle":
        audio.paddle();
        break;
      case "wall":
        audio.wall();
        break;
      case "lifeLost":
        shake = SHAKE_TIME;
        trail = [];
        audio.lifeLost();
        break;
      case "win":
        rain(state.bricks);
        audio.win();
        break;
      case "lose":
        audio.lose();
        break;
    }
  }
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  newBest = score > best && score > 0;
  if (!newBest) return;
  best = score;
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // storage unavailable
  }
}

// ---------- update ----------

function update(dt) {
  const input = readInput();
  const before = state;
  state = step(state, input, dt);

  if (state !== before) {
    trail = [];
    particles = [];
    shake = 0;
    flash = 0;
    newBest = false;
  }

  handleEvents(state.events);

  if (state.status !== lastStatus) {
    panelTime = 0;
    if (state.status === "won" || state.status === "lost") saveBest(state.score);
    lastStatus = state.status;
  }
  panelTime += dt;

  const b = state.ball;
  if (state.status === "playing" && !b.stuck) {
    trail.push({ x: b.x, y: b.y });
    if (trail.length > TRAIL_LENGTH) trail.shift();
  } else if (trail.length) {
    trail.shift();
  }

  for (const p of particles) {
    p.age += dt;
    if (p.age < 0) continue;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  particles = particles.filter((p) => p.age < p.life && p.y < HEIGHT + 10);

  shake = Math.max(0, shake - dt);
  flash = Math.max(0, flash - dt);
}

// ---------- draw ----------

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  g.addColorStop(0, BG_TOP);
  g.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(-SHAKE_SIZE * 2, -SHAKE_SIZE * 2, WIDTH + SHAKE_SIZE * 4, HEIGHT + SHAKE_SIZE * 4);

  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 24; x < WIDTH; x += 24) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, HEIGHT);
  }
  for (let y = 24; y < HEIGHT; y += 24) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(WIDTH, y + 0.5);
  }
  ctx.stroke();
}

function drawBricks() {
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    const color = ROW_COLORS[brick.row % ROW_COLORS.length];
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    roundRect(brick.x, brick.y, brick.w, brick.h, 4);
    ctx.fill();
    ctx.restore();

    const hl = ctx.createLinearGradient(0, brick.y, 0, brick.y + brick.h);
    hl.addColorStop(0, "rgba(255,255,255,0.45)");
    hl.addColorStop(0.45, "rgba(255,255,255,0.08)");
    hl.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = hl;
    roundRect(brick.x, brick.y, brick.w, brick.h, 4);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    roundRect(brick.x + 4, brick.y + 2, brick.w - 8, 2, 1);
    ctx.fill();
  }
}

function drawPaddle() {
  const p = state.paddle;
  ctx.save();
  const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(1, "#A5F0FA");
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 16;
  ctx.fillStyle = g;
  roundRect(p.x, p.y, p.w, p.h, p.h / 2);
  ctx.fill();
  ctx.restore();
}

function drawBall() {
  if (state.status === "lost" || state.status === "won") return;
  const b = state.ball;
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i];
    const k = (i + 1) / (trail.length + 1);
    ctx.fillStyle = `rgba(62,209,230,${0.35 * k})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, b.r * (0.4 + 0.6 * k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(onTop) {
  ctx.save();
  for (const p of particles) {
    if (p.age < 0 || Boolean(p.onTop) !== onTop) continue;
    const a = 1 - p.age / p.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

function setFont(size, family, weight = 400, spacing = "0.08em") {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = spacing;
}

function drawHud() {
  const y = 24;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  setFont(12, MONO, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText("SCORE", 16, y);
  const labelW = ctx.measureText("SCORE ").width;

  const f = flash / FLASH_TIME;
  setFont(16, MONO, 500);
  ctx.save();
  if (f > 0) {
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 12 * f;
  }
  ctx.fillStyle = f > 0 ? mix(TEXT, ACCENT, f) : TEXT;
  ctx.fillText(String(state.score).padStart(4, "0"), 16 + labelW + 4, y + 0.5);
  ctx.restore();

  const w = 18;
  const h = 5;
  const gap = 6;
  for (let i = 0; i < START_LIVES; i++) {
    const x = WIDTH - 16 - w - i * (w + gap);
    const alive = i < state.lives;
    ctx.save();
    if (alive) {
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#DFFAFE";
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
    }
    roundRect(x, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.restore();
  }
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const c = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

function pulse() {
  return 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(performance.now() / 320));
}

function drawPanel(title, titleColor, lines, hint) {
  const t = Math.min(1, panelTime / PANEL_FADE);
  const ease = 1 - (1 - t) ** 3;
  const w = 280;
  const h = 168;
  const x = (WIDTH - w) / 2;
  const y = (HEIGHT - h) / 2 + 16 + (1 - ease) * 8;

  ctx.save();
  ctx.globalAlpha = ease;
  ctx.fillStyle = "rgba(5,7,13,0.45)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 32;
  ctx.fillStyle = "rgba(9,13,26,0.86)";
  roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = WIDTH / 2;

  setFont(40, SANS, 700, "-0.01em");
  ctx.save();
  ctx.shadowColor = titleColor;
  ctx.shadowBlur = 20;
  ctx.fillStyle = titleColor;
  ctx.fillText(title, cx, y + 56);
  ctx.restore();

  setFont(12, MONO, 400);
  ctx.fillStyle = MUTED;
  ctx.fillText(lines, cx, y + 100);

  setFont(13, MONO, 500);
  ctx.globalAlpha = ease * pulse();
  ctx.fillStyle = TEXT;
  ctx.fillText(hint, cx, y + 136);
  ctx.restore();
}

function scoreLine() {
  const parts = [`SCORE ${state.score}`, `BEST ${Math.max(best, state.score)}`];
  return newBest ? `${parts[0]}  ·  NEW BEST` : parts.join("  ·  ");
}

function drawOverlay() {
  if (state.status === "ready") {
    drawPanel("Breakout", TEXT, best > 0 ? `BEST ${best}` : "BREAK EVERY BRICK", "PRESS SPACE TO START");
  } else if (state.status === "won") {
    drawPanel("You win", WIN, scoreLine(), "PRESS R TO PLAY AGAIN");
  } else if (state.status === "lost") {
    drawPanel("Game over", LOSE, scoreLine(), "PRESS R TO PLAY AGAIN");
  } else if (state.ball.stuck) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    setFont(12, MONO, 500);
    ctx.globalAlpha = pulse();
    ctx.fillStyle = TEXT;
    ctx.fillText("PRESS SPACE TO LAUNCH", WIDTH / 2, 252);
    ctx.restore();
  }
}

function draw() {
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  if (shake > 0) {
    const k = shake / SHAKE_TIME;
    ctx.translate((Math.random() * 2 - 1) * SHAKE_SIZE * k, (Math.random() * 2 - 1) * SHAKE_SIZE * k);
  }
  drawBackground();
  drawBricks();
  drawParticles(false);
  drawPaddle();
  drawBall();
  ctx.restore();

  drawHud();
  drawOverlay();
  drawParticles(true);
}

// ---------- loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
