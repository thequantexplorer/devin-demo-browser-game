// Game logic only. No DOM or canvas code here, so it can be unit tested.
// The rules and the shape of the game state are in README.md.

export const WIDTH = 480;
export const HEIGHT = 360;

const PADDLE_W = 72;
const PADDLE_H = 10;
const PADDLE_Y = HEIGHT - 30;
const PADDLE_SPEED = 380;

const BALL_R = 6;
const BALL_SPEED = 280;
const LAUNCH_ANGLE = (25 * Math.PI) / 180;
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_H = 14;
const BRICK_GAP = 4;
const BRICK_TOP = 40;
const BRICK_SIDE = 16;
const BRICK_W = (WIDTH - 2 * BRICK_SIDE - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;

const MAX_SUBSTEP = 1 / 240;

function createBricks() {
  const bricks = [];
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      bricks.push({
        x: BRICK_SIDE + col * (BRICK_W + BRICK_GAP),
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
  ball.y = paddle.y - ball.r;
  ball.vx = 0;
  ball.vy = 0;
}

export function createGame() {
  const paddle = { x: (WIDTH - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball = { x: 0, y: 0, r: BALL_R, vx: 0, vy: 0 };
  restBallOnPaddle(ball, paddle);
  return { status: 'ready', score: 0, lives: 3, paddle, ball, bricks: createBricks() };
}

function clone(state) {
  return {
    ...state,
    paddle: { ...state.paddle },
    ball: { ...state.ball },
    bricks: state.bricks.map((b) => ({ ...b })),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function overlaps(ball, rect) {
  const cx = clamp(ball.x, rect.x, rect.x + rect.w);
  const cy = clamp(ball.y, rect.y, rect.y + rect.h);
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  return dx * dx + dy * dy < ball.r * ball.r;
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
  // Where the ball hits the paddle sets the bounce angle: centre goes straight up, edges go wide.
  const offset = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
  const angle = offset * MAX_BOUNCE_ANGLE;
  const speed = Math.hypot(ball.vx, ball.vy);
  ball.vx = speed * Math.sin(angle);
  ball.vy = -speed * Math.cos(angle);
  ball.y = paddle.y - ball.r;
}

function hitBrick(ball, bricks) {
  const brick = bricks.find((b) => b.alive && overlaps(ball, b));
  if (!brick) return false;
  brick.alive = false;
  const overlapX = Math.min(ball.x + ball.r - brick.x, brick.x + brick.w - (ball.x - ball.r));
  const overlapY = Math.min(ball.y + ball.r - brick.y, brick.y + brick.h - (ball.y - ball.r));
  if (overlapX < overlapY) {
    ball.vx = ball.x < brick.x + brick.w / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
  } else {
    ball.vy = ball.y < brick.y + brick.h / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
  }
  return true;
}

function moveBall(s, dt) {
  const { ball, paddle, bricks } = s;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  bounceOffWalls(ball);
  bounceOffPaddle(ball, paddle);
  if (hitBrick(ball, bricks)) {
    s.score += 10;
    if (bricks.every((b) => !b.alive)) {
      s.status = 'won';
      return;
    }
  }
  if (ball.y - ball.r > HEIGHT) {
    s.lives -= 1;
    if (s.lives > 0) {
      s.status = 'ready';
      restBallOnPaddle(ball, paddle);
    } else {
      s.status = 'lost';
    }
  }
}

export function step(state, input, dt) {
  if (state.status === 'won' || state.status === 'lost') return state;
  const s = clone(state);
  const { paddle, ball } = s;

  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  paddle.x = clamp(paddle.x + direction * PADDLE_SPEED * dt, 0, WIDTH - paddle.w);

  if (s.status === 'ready') {
    restBallOnPaddle(ball, paddle);
    if (input.launch) {
      s.status = 'playing';
      const side = input.left && !input.right ? -1 : 1;
      ball.vx = side * BALL_SPEED * Math.sin(LAUNCH_ANGLE);
      ball.vy = -BALL_SPEED * Math.cos(LAUNCH_ANGLE);
    }
    return s;
  }

  const substeps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
  for (let i = 0; i < substeps && s.status === 'playing'; i++) {
    moveBall(s, dt / substeps);
  }
  return s;
}
