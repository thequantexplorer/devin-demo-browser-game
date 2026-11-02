import { createGame, step, WIDTH, HEIGHT } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ROW_COLORS = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#3ddc97', '#4cc9f0'];
const MAX_DT = 1 / 30;

const keys = { left: false, right: false };
let launchQueued = false;
let state = createGame();

const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);
const GAME_KEYS = new Set([...LEFT_KEYS, ...RIGHT_KEYS, 'Space', 'KeyR']);

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (LEFT_KEYS.has(e.code)) keys.left = true;
  if (RIGHT_KEYS.has(e.code)) keys.right = true;
  if (e.code === 'Space' && !e.repeat) launchQueued = true;
  if (e.code === 'KeyR' && !e.repeat) {
    state = createGame();
    launchQueued = false;
  }
});

window.addEventListener('keyup', (e) => {
  if (LEFT_KEYS.has(e.code)) keys.left = false;
  if (RIGHT_KEYS.has(e.code)) keys.right = false;
});

window.addEventListener('blur', () => {
  keys.left = false;
  keys.right = false;
});

function resize() {
  const scale = (canvas.clientWidth / WIDTH) * (window.devicePixelRatio || 1);
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function drawText(text, x, y, size, align = 'center', color = '#eee') {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const rowYs = [...new Set(state.bricks.map((b) => b.y))].sort((a, b) => a - b);
  for (const b of state.bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = ROW_COLORS[rowYs.indexOf(b.y) % ROW_COLORS.length];
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  const { paddle, ball } = state;
  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 4);
  ctx.fill();

  if (state.status !== 'lost') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawText(`Score: ${state.score}`, 12, 18, 14, 'left');
  drawText(`Lives: ${state.lives}`, WIDTH - 12, 18, 14, 'right');

  if (state.status === 'ready') {
    drawText('Press Space to launch', WIDTH / 2, HEIGHT * 0.65, 16, 'center', '#aaa');
  } else if (state.status === 'won' || state.status === 'lost') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const won = state.status === 'won';
    drawText(won ? 'You win' : 'Game over', WIDTH / 2, HEIGHT / 2 - 16, 36, 'center', won ? '#3ddc97' : '#ff5a5f');
    drawText('Press R to play again', WIDTH / 2, HEIGHT / 2 + 22, 16, 'center', '#ccc');
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, MAX_DT);
  last = now;
  state = step(state, { ...keys, launch: launchQueued }, dt);
  launchQueued = false;
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
