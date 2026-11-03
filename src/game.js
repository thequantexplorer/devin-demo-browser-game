// Game logic only. No DOM or canvas code here, so it can be unit tested.
// The rules and the shape of the game state are in README.md.

export const WIDTH = 480;
export const HEIGHT = 360;

export const BRICK_ROWS = 5;
export const BRICK_COLS = 8;
const BRICK_W = 50;
const BRICK_H = 16;
const BRICK_GAP = 6;
const BRICK_TOP = 56;

const PADDLE_W = 72;
const PADDLE_H = 10;
const PADDLE_Y = HEIGHT - 32;
const PADDLE_SPEED = 420;

const BALL_R = 5;
const BALL_SPEED = 300;
const BALL_SPEED_STEP = 5;
const BALL_SPEED_MAX = 460;
const LAUNCH_ANGLE = (20 * Math.PI) / 180;
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

const MAX_SUBSTEP = 2;
const POINTS_PER_BRICK = 10;

function createBricks() {
  const rowWidth = BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP;
  const left = (WIDTH - rowWidth) / 2;
  const bricks = [];
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      bricks.push({
        x: left + col * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        alive: true,
      });
    }
  }
  return bricks;
}

function restBallOnPaddle(ball, paddle) {
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - ball.r - 1;
  ball.vx = 0;
  ball.vy = 0;
}

export function createGame() {
  const paddle = { x: (WIDTH - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball = { x: 0, y: 0, r: BALL_R, vx: 0, vy: 0 };
  restBallOnPaddle(ball, paddle);
  return {
    status: 'ready',
    score: 0,
    lives: 3,
    paddle,
    ball,
    bricks: createBricks(),
  };
}

function clone(state) {
  return {
    ...state,
    paddle: { ...state.paddle },
    ball: { ...state.ball },
    bricks: state.bricks.map((b) => ({ ...b })),
  };
}

function speedOf(ball) {
  return Math.hypot(ball.vx, ball.vy);
}

function setSpeed(ball, speed) {
  const current = speedOf(ball);
  if (current === 0) return;
  ball.vx = (ball.vx / current) * speed;
  ball.vy = (ball.vy / current) * speed;
}

function overlaps(ball, rect) {
  const cx = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
  return (ball.x - cx) ** 2 + (ball.y - cy) ** 2 <= ball.r ** 2;
}

function bounceOffWalls(ball) {
  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + ball.r > WIDTH) {
    ball.x = WIDTH - ball.r;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
  }
}

function bounceOffPaddle(ball, paddle) {
  if (ball.vy <= 0 || !overlaps(ball, paddle)) return;
  const offset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
  const angle = Math.max(-1, Math.min(1, offset)) * MAX_BOUNCE_ANGLE;
  const speed = Math.max(speedOf(ball), BALL_SPEED);
  ball.vx = speed * Math.sin(angle);
  ball.vy = -speed * Math.cos(angle);
  ball.y = paddle.y - ball.r;
}

function hitBrick(state) {
  const { ball } = state;
  const brick = state.bricks.find((b) => b.alive && overlaps(ball, b));
  if (!brick) return;

  brick.alive = false;
  state.score += POINTS_PER_BRICK;

  const overlapX = Math.min(ball.x + ball.r - brick.x, brick.x + brick.w - (ball.x - ball.r));
  const overlapY = Math.min(ball.y + ball.r - brick.y, brick.y + brick.h - (ball.y - ball.r));
  if (overlapX < overlapY) {
    ball.vx = ball.x < brick.x + brick.w / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
  } else {
    ball.vy = ball.y < brick.y + brick.h / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
  }
  setSpeed(ball, Math.min(speedOf(ball) + BALL_SPEED_STEP, BALL_SPEED_MAX));

  if (state.bricks.every((b) => !b.alive)) state.status = 'won';
}

function loseBall(state) {
  state.lives -= 1;
  if (state.lives > 0) {
    state.status = 'ready';
    restBallOnPaddle(state.ball, state.paddle);
  } else {
    state.status = 'lost';
  }
}

export function step(state, input, dt) {
  if (state.status === 'won' || state.status === 'lost') return state;

  const s = clone(state);
  const { paddle, ball } = s;

  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  paddle.x = Math.max(0, Math.min(WIDTH - paddle.w, paddle.x + direction * PADDLE_SPEED * dt));

  if (s.status === 'ready') {
    restBallOnPaddle(ball, paddle);
    if (!input.launch) return s;
    const side = input.left && !input.right ? -1 : 1;
    ball.vx = side * BALL_SPEED * Math.sin(LAUNCH_ANGLE);
    ball.vy = -BALL_SPEED * Math.cos(LAUNCH_ANGLE);
    s.status = 'playing';
  }

  const distance = speedOf(ball) * dt;
  const substeps = Math.max(1, Math.ceil(distance / MAX_SUBSTEP));
  const h = dt / substeps;
  for (let i = 0; i < substeps && s.status === 'playing'; i++) {
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    bounceOffWalls(ball);
    bounceOffPaddle(ball, paddle);
    hitBrick(s);
    if (ball.y - ball.r > HEIGHT) loseBall(s);
  }

  return s;
}
