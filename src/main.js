import { createGame, step, WIDTH, HEIGHT, BRICK_COLS } from './game.js';

const ROW_COLORS = ['#FF5A3C', '#FF9F1C', '#FFD23F', '#7BE07B', '#3ED1E6'];
const ACCENT = '#3ED1E6';
const WIN = '#7BE07B';
const LOSE = '#FF5A3C';
const TEXT = 'rgba(255, 255, 255, 0.92)';
const TEXT_QUIET = 'rgba(255, 255, 255, 0.5)';
const MONO = '"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';
const SANS = 'Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

const TRAIL_LENGTH = 8;
const PARTICLE_LIFE = 400;
const SHAKE_TIME = 200;
const FLASH_TIME = 250;
const PANEL_IN = 200;
const BRICK_IN = 220;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Canvas sizing: CSS sets the displayed size, the backing store follows it at devicePixelRatio.
function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
resize();

// Sound: tiny Web Audio blips, started on the first key press.
let audio = null;
function startAudio() {
  if (audio) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.18;
  master.connect(context.destination);
  audio = { context, master };
}

function blip(freq, duration, { type = 'square', to = freq, delay = 0, volume = 0.5 } = {}) {
  if (!audio) return;
  const { context, master } = audio;
  const t = context.currentTime + delay;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

const sounds = {
  launch: () => blip(520, 0.08, { type: 'triangle', to: 780 }),
  paddle: () => blip(330, 0.09, { type: 'triangle', to: 440, volume: 0.6 }),
  brick: (row) => blip(880 - row * 90, 0.07, { volume: 0.25 }),
  lifeLost: () => blip(300, 0.35, { type: 'sawtooth', to: 70, volume: 0.3 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.16, { type: 'triangle', delay: i * 0.09 })),
  gameOver: () => {
    blip(330, 0.22, { type: 'triangle', to: 250 });
    blip(250, 0.45, { type: 'triangle', to: 90, delay: 0.2 });
  },
};

// Input
const keys = { left: false, right: false };
let launchPressed = false;
const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);

window.addEventListener('keydown', (e) => {
  startAudio();
  if (LEFT_KEYS.has(e.code)) keys.left = true;
  else if (RIGHT_KEYS.has(e.code)) keys.right = true;
  else if (e.code === 'Space') {
    if (!e.repeat) launchPressed = true;
  } else if (e.code === 'KeyR') {
    if (!e.repeat) restart();
  } else return;
  e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  if (LEFT_KEYS.has(e.code)) keys.left = false;
  else if (RIGHT_KEYS.has(e.code)) keys.right = false;
});

window.addEventListener('blur', () => {
  keys.left = false;
  keys.right = false;
});

// Game and effects state
let state;
let brickRows;
let particles;
let trail;
let shakeAt;
let flashAt;
let panelAt;
let introAt;
let lastPanel;

function restart() {
  state = createGame();
  const rowYs = [...new Set(state.bricks.map((b) => b.y))].sort((a, b) => a - b);
  brickRows = state.bricks.map((b) => rowYs.indexOf(b.y));
  particles = [];
  trail = [];
  shakeAt = -Infinity;
  flashAt = -Infinity;
  panelAt = performance.now();
  introAt = performance.now();
  lastPanel = null;
}

function colorOf(index) {
  return ROW_COLORS[brickRows[index] % ROW_COLORS.length];
}

function burst(brick, color) {
  const count = 12 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 160;
    particles.push({
      x: brick.x + brick.w / 2 + (Math.random() - 0.5) * brick.w * 0.6,
      y: brick.y + brick.h / 2 + (Math.random() - 0.5) * brick.h * 0.6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 220,
      size: 2 + Math.random() * 2.5,
      color,
      life: PARTICLE_LIFE,
      age: 0,
    });
  }
}

function rain() {
  state.bricks.forEach((brick, i) => {
    for (let k = 0; k < 6; k++) {
      particles.push({
        x: brick.x + Math.random() * brick.w,
        y: brick.y + Math.random() * brick.h,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 60,
        gravity: 180 + Math.random() * 80,
        size: 1.5 + Math.random() * 2.5,
        color: colorOf(i),
        life: 1600 + Math.random() * 600,
        age: -Math.random() * 500,
      });
    }
  });
}

// Compare the state before and after a step to trigger visual and sound effects.
function react(prev, next, now) {
  next.bricks.forEach((b, i) => {
    if (prev.bricks[i].alive && !b.alive) {
      burst(b, colorOf(i));
      sounds.brick(brickRows[i]);
      flashAt = now;
    }
  });
  if (prev.status === 'ready' && next.status === 'playing') sounds.launch();
  if (next.status === 'playing' && prev.ball.vy > 0 && next.ball.vy < 0 && next.ball.y > next.paddle.y - 24) {
    sounds.paddle();
  }
  if (next.lives < prev.lives) {
    shakeAt = now;
    trail = [];
    if (next.status !== 'lost') sounds.lifeLost();
  }
  if (prev.status !== 'won' && next.status === 'won') {
    rain();
    sounds.win();
  }
  if (prev.status !== 'lost' && next.status === 'lost') sounds.gameOver();
}

function update(dt, now) {
  const prev = state;
  state = step(state, { left: keys.left, right: keys.right, launch: launchPressed }, dt);
  launchPressed = false;
  react(prev, state, now);

  if (state.status === 'playing') {
    trail.push({ x: state.ball.x, y: state.ball.y });
    if (trail.length > TRAIL_LENGTH) trail.shift();
  } else {
    trail = [];
  }

  for (const p of particles) {
    p.age += dt * 1000;
    if (p.age < 0) continue;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  particles = particles.filter((p) => p.age < p.life && p.y < HEIGHT + 20);
}

// Drawing
const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  g.addColorStop(0, '#0B1226');
  g.addColorStop(1, '#05070D');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
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

function drawBricks(now) {
  state.bricks.forEach((b, i) => {
    if (!b.alive) return;
    const row = brickRows[i];
    const col = i % BRICK_COLS;
    const t = ease((now - introAt - row * 40 - col * 20) / BRICK_IN);
    if (t <= 0) return;
    const color = colorOf(i);
    const y = b.y - (1 - t) * 8;

    ctx.save();
    ctx.globalAlpha = t;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(b.x, y, b.w, b.h, 4);
    ctx.fill();

    ctx.shadowBlur = 0;
    const hl = ctx.createLinearGradient(0, y, 0, y + b.h);
    hl.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    hl.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
    hl.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
    ctx.fillStyle = hl;
    ctx.fill();
    ctx.restore();
  });
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    if (p.age < 0) continue;
    const t = p.age / p.life;
    const size = p.size * (1 - 0.4 * t);
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(p.x - size / 2, p.y - size / 2, size, size, size / 3);
    ctx.fill();
  }
  ctx.restore();
}

function drawBall() {
  const { ball } = state;
  if (state.status === 'lost') return;

  trail.forEach((p, i) => {
    const t = (i + 1) / (trail.length + 1);
    ctx.globalAlpha = t * 0.35;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ball.r * (0.4 + 0.6 * t), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPaddleShape(x, y, w, h, glow) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(1, '#9FEFFA');
  ctx.save();
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = glow;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();
}

function drawPaddle() {
  const { paddle } = state;
  drawPaddleShape(paddle.x, paddle.y, paddle.w, paddle.h, 18);
}

function setFont(size, family, weight = 400) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = family === MONO ? `${(size * 0.08).toFixed(2)}px` : '0px';
}

function drawHud(now) {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  setFont(16, MONO);
  ctx.fillStyle = TEXT_QUIET;
  ctx.fillText('SCORE', 24, 28);
  const labelW = ctx.measureText('SCORE ').width;

  const flash = 1 - Math.min(1, (now - flashAt) / FLASH_TIME);
  const value = String(state.score).padStart(4, '0');
  ctx.save();
  ctx.translate(24 + labelW, 28);
  ctx.scale(1 + flash * 0.12, 1 + flash * 0.12);
  setFont(16, MONO, 600);
  ctx.fillStyle = flash > 0 ? ACCENT : TEXT;
  ctx.globalAlpha = 1;
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = flash * 12;
  ctx.fillText(value, 0, 0);
  ctx.restore();

  const w = 20;
  const h = 6;
  const gap = 8;
  for (let i = 0; i < 3; i++) {
    const x = WIDTH - 24 - w - (2 - i) * (w + gap);
    if (i < state.lives) {
      drawPaddleShape(x, 28 - h / 2, w, h, 10);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect(x, 28 - h / 2, w, h, h / 2);
      ctx.fill();
    }
  }
}

function pulse(now) {
  return 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now / 320));
}

function currentPanel() {
  if (state.status === 'won') return 'won';
  if (state.status === 'lost') return 'lost';
  if (state.status === 'ready' && state.lives === 3 && state.score === 0) return 'start';
  return null;
}

function drawPanel(kind, now) {
  const t = ease((now - panelAt) / PANEL_IN);
  const panel = {
    start: { title: 'Breakout', color: TEXT, line: `CLEAR ALL ${state.bricks.length} BRICKS`, prompt: 'Press Space to start' },
    won: { title: 'You win', color: WIN, line: `SCORE ${String(state.score).padStart(4, '0')}`, prompt: 'Press R to play again' },
    lost: { title: 'Game over', color: LOSE, line: `SCORE ${String(state.score).padStart(4, '0')}`, prompt: 'Press R to play again' },
  }[kind];

  ctx.save();
  ctx.globalAlpha = t;
  ctx.fillStyle = 'rgba(5, 7, 13, 0.55)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const pw = 288;
  const ph = 168;
  const scale = 0.96 + 0.04 * t;
  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(9, 13, 26, 0.94)';
  ctx.beginPath();
  ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  setFont(40, SANS, 700);
  ctx.letterSpacing = '-0.8px';
  ctx.fillStyle = panel.color;
  ctx.shadowColor = kind === 'start' ? ACCENT : panel.color;
  ctx.shadowBlur = 20;
  ctx.fillText(panel.title, 0, -32);
  ctx.shadowBlur = 0;

  setFont(13, MONO);
  ctx.fillStyle = TEXT_QUIET;
  ctx.fillText(panel.line, 0, 16);

  setFont(15, SANS, 600);
  ctx.globalAlpha = t * pulse(now);
  ctx.fillStyle = TEXT;
  ctx.fillText(panel.prompt, 0, 48);
  ctx.restore();
}

function drawLaunchHint(now) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setFont(13, SANS, 600);
  ctx.globalAlpha = pulse(now) * 0.8;
  ctx.fillStyle = TEXT;
  ctx.fillText('Press Space to launch', WIDTH / 2, state.paddle.y - 56);
  ctx.restore();
}

function draw(now) {
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  drawBackground();

  ctx.save();
  const shake = 1 - (now - shakeAt) / SHAKE_TIME;
  if (shake > 0) {
    const amount = 5 * shake;
    ctx.translate((Math.random() * 2 - 1) * amount, (Math.random() * 2 - 1) * amount);
  }
  drawBricks(now);
  drawParticles();
  drawPaddle();
  drawBall();
  drawHud(now);
  ctx.restore();

  const panel = currentPanel();
  if (panel !== lastPanel) {
    panelAt = now;
    lastPanel = panel;
  }
  if (panel) drawPanel(panel, now);
  else if (state.status === 'ready') drawLaunchHint(now);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt, now);
  draw(now);
  requestAnimationFrame(frame);
}

restart();
requestAnimationFrame(frame);
