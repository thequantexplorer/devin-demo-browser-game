export const WIDTH = 480;
export const HEIGHT = 360;

export const PADDLE_WIDTH = 72;
export const PADDLE_HEIGHT = 10;
export const PADDLE_Y = HEIGHT - 28;
export const PADDLE_SPEED = 360;

export const BALL_RADIUS = 5;
export const BALL_SPEED = 270;
export const BALL_MAX_SPEED = 380;
export const BALL_SPEEDUP = 3;
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;
const LAUNCH_ANGLE = (20 * Math.PI) / 180;

export const BRICK_ROWS = 5;
export const BRICK_COLS = 8;
export const BRICK_HEIGHT = 16;
export const BRICK_GAP = 6;
export const BRICK_TOP = 48;
export const BRICK_SIDE = 24;
export const BRICK_POINTS = 10;

export const START_LIVES = 3;

const MAX_SUBSTEP = 1 / 240;

export function createBricks(rows = BRICK_ROWS, cols = BRICK_COLS) {
  const w = (WIDTH - BRICK_SIDE * 2 - BRICK_GAP * (cols - 1)) / cols;
  const bricks = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      bricks.push({
        x: BRICK_SIDE + col * (w + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
        w,
        h: BRICK_HEIGHT,
        row,
        col,
        alive: true,
      });
    }
  }
  return bricks;
}

function ballOnPaddle(paddle) {
  return {
    x: paddle.x + paddle.w / 2,
    y: paddle.y - BALL_RADIUS - 1,
    vx: 0,
    vy: 0,
    r: BALL_RADIUS,
    speed: BALL_SPEED,
    stuck: true,
  };
}

/**
 * Creates a new game. `status` is one of:
 * "ready" (start screen), "playing", "won" or "lost".
 */
export function createGame({ rows = BRICK_ROWS, cols = BRICK_COLS } = {}) {
  const paddle = {
    x: (WIDTH - PADDLE_WIDTH) / 2,
    y: PADDLE_Y,
    w: PADDLE_WIDTH,
    h: PADDLE_HEIGHT,
  };
  return {
    status: "ready",
    paddle,
    ball: ballOnPaddle(paddle),
    bricks: createBricks(rows, cols),
    layout: { rows, cols },
    score: 0,
    lives: START_LIVES,
    events: [],
  };
}

export function bricksLeft(state) {
  return state.bricks.filter((b) => b.alive).length;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function movePaddle(state, input, dt) {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const p = state.paddle;
  p.x = clamp(p.x + dir * PADDLE_SPEED * dt, 0, WIDTH - p.w);
}

function launch(state, input) {
  const b = state.ball;
  const dir = input.left && !input.right ? -1 : 1;
  b.stuck = false;
  b.vx = Math.sin(LAUNCH_ANGLE) * b.speed * dir;
  b.vy = -Math.cos(LAUNCH_ANGLE) * b.speed;
  state.events.push({ type: "launch" });
}

function setSpeed(ball, speed) {
  const current = Math.hypot(ball.vx, ball.vy) || 1;
  ball.vx = (ball.vx / current) * speed;
  ball.vy = (ball.vy / current) * speed;
  ball.speed = speed;
}

function hitWalls(state) {
  const b = state.ball;
  if (b.x - b.r < 0) {
    b.x = b.r;
    b.vx = Math.abs(b.vx);
    state.events.push({ type: "wall" });
  } else if (b.x + b.r > WIDTH) {
    b.x = WIDTH - b.r;
    b.vx = -Math.abs(b.vx);
    state.events.push({ type: "wall" });
  }
  if (b.y - b.r < 0) {
    b.y = b.r;
    b.vy = Math.abs(b.vy);
    state.events.push({ type: "wall" });
  }
}

function hitPaddle(state) {
  const b = state.ball;
  const p = state.paddle;
  if (b.vy <= 0) return;
  const overlapsX = b.x + b.r >= p.x && b.x - b.r <= p.x + p.w;
  const overlapsY = b.y + b.r >= p.y && b.y - b.r <= p.y + p.h;
  if (!overlapsX || !overlapsY) return;
  const offset = clamp((b.x - (p.x + p.w / 2)) / (p.w / 2), -1, 1);
  const angle = offset * MAX_BOUNCE_ANGLE;
  b.vx = Math.sin(angle) * b.speed;
  b.vy = -Math.cos(angle) * b.speed;
  b.y = p.y - b.r;
  state.events.push({ type: "paddle" });
}

function hitBricks(state) {
  const b = state.ball;
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    const nx = clamp(b.x, brick.x, brick.x + brick.w);
    const ny = clamp(b.y, brick.y, brick.y + brick.h);
    const dx = b.x - nx;
    const dy = b.y - ny;
    if (dx * dx + dy * dy > b.r * b.r) continue;

    brick.alive = false;
    state.score += BRICK_POINTS;
    state.events.push({ type: "brick", brick });

    const overlapX = Math.min(b.x + b.r - brick.x, brick.x + brick.w - (b.x - b.r));
    const overlapY = Math.min(b.y + b.r - brick.y, brick.y + brick.h - (b.y - b.r));
    if (overlapX < overlapY) {
      b.vx = b.x < brick.x + brick.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
    } else {
      b.vy = b.y < brick.y + brick.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
    }
    setSpeed(b, Math.min(BALL_MAX_SPEED, b.speed + BALL_SPEEDUP));

    if (bricksLeft(state) === 0) {
      state.status = "won";
      b.vx = 0;
      b.vy = 0;
      state.events.push({ type: "win" });
    }
    return;
  }
}

function checkMissed(state) {
  const b = state.ball;
  if (b.y - b.r <= HEIGHT) return;
  state.lives -= 1;
  if (state.lives <= 0) {
    state.lives = 0;
    state.status = "lost";
    b.vx = 0;
    b.vy = 0;
    state.events.push({ type: "lifeLost" }, { type: "lose" });
    return;
  }
  state.ball = ballOnPaddle(state.paddle);
  state.events.push({ type: "lifeLost" });
}

function moveBall(state, dt) {
  const b = state.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  hitWalls(state);
  hitPaddle(state);
  hitBricks(state);
  if (state.status === "playing") checkMissed(state);
}

/**
 * Advances the game by `dt` seconds. `input` is
 * { left, right, launch, restart }, where `launch` and `restart`
 * are true only on the frame the key was pressed.
 * Mutates and returns `state`; `state.events` lists what happened this step.
 */
export function step(state, input = {}, dt = 0) {
  if (input.restart) return createGame(state.layout);

  state.events = [];
  if (state.status === "won" || state.status === "lost") return state;

  if (state.status === "ready") {
    if (!input.launch) return state;
    state.status = "playing";
  }

  let remaining = Math.max(0, dt);
  if (input.launch && state.ball.stuck) launch(state, input);

  while (remaining > 0 && state.status === "playing") {
    const h = Math.min(remaining, MAX_SUBSTEP);
    remaining -= h;
    movePaddle(state, input, h);
    if (state.ball.stuck) {
      state.ball.x = state.paddle.x + state.paddle.w / 2;
      state.ball.y = state.paddle.y - state.ball.r - 1;
    } else {
      moveBall(state, h);
    }
  }

  return state;
}
