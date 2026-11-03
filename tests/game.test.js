import { describe, it, expect } from "vitest";
import {
  createGame,
  step,
  bricksLeft,
  WIDTH,
  HEIGHT,
  BRICK_POINTS,
  BRICK_ROWS,
  BRICK_COLS,
  START_LIVES,
} from "../src/game.js";

const DT = 1 / 60;

function playing(options) {
  const state = createGame(options);
  return step(state, { launch: true }, 0);
}

function run(state, input, seconds) {
  let s = state;
  for (let t = 0; t < seconds; t += DT) s = step(s, input, DT);
  return s;
}

function placeBall(state, { x, y, vx, vy }) {
  Object.assign(state.ball, { x, y, vx, vy, stuck: false });
  state.ball.speed = Math.hypot(vx, vy);
}

function clearBricks(state) {
  for (const b of state.bricks) b.alive = false;
}

describe("createGame", () => {
  it("starts on the ready screen with a full wall, 0 points and 3 lives", () => {
    const s = createGame();
    expect(s.status).toBe("ready");
    expect(s.score).toBe(0);
    expect(s.lives).toBe(START_LIVES);
    expect(s.lives).toBe(3);
    expect(s.bricks).toHaveLength(BRICK_ROWS * BRICK_COLS);
    expect(s.ball.stuck).toBe(true);
  });

  it("puts every brick inside the top half of the 480 x 360 area", () => {
    const s = createGame();
    for (const b of s.bricks) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(WIDTH);
      expect(b.y + b.h).toBeLessThanOrEqual(HEIGHT / 2);
    }
  });

  it("puts the paddle at the bottom with the ball resting on it", () => {
    const s = createGame();
    expect(s.paddle.y).toBeGreaterThan(HEIGHT * 0.8);
    expect(s.ball.x).toBeCloseTo(s.paddle.x + s.paddle.w / 2);
    expect(s.ball.y).toBeLessThan(s.paddle.y);
  });
});

describe("paddle", () => {
  it("moves left and right", () => {
    const s = playing();
    const start = s.paddle.x;
    step(s, { right: true }, 0.1);
    expect(s.paddle.x).toBeGreaterThan(start);
    const mid = s.paddle.x;
    step(s, { left: true }, 0.1);
    expect(s.paddle.x).toBeLessThan(mid);
  });

  it("never leaves the left edge of the screen", () => {
    const s = playing();
    run(s, { left: true }, 3);
    expect(s.paddle.x).toBe(0);
  });

  it("never leaves the right edge of the screen", () => {
    const s = playing();
    run(s, { right: true }, 3);
    expect(s.paddle.x + s.paddle.w).toBe(WIDTH);
  });

  it("carries the ball while it is on the paddle", () => {
    const s = createGame();
    s.status = "playing";
    run(s, { right: true }, 0.2);
    expect(s.ball.stuck).toBe(true);
    expect(s.ball.x).toBeCloseTo(s.paddle.x + s.paddle.w / 2);
  });
});

describe("launch", () => {
  it("waits on the ready screen until Space is pressed", () => {
    const s = createGame();
    run(s, { right: true }, 0.5);
    expect(s.status).toBe("ready");
    expect(s.ball.stuck).toBe(true);
  });

  it("Space launches the ball upwards", () => {
    const s = createGame();
    step(s, { launch: true }, DT);
    expect(s.status).toBe("playing");
    expect(s.ball.stuck).toBe(false);
    expect(s.ball.vy).toBeLessThan(0);
  });
});

describe("ball", () => {
  it("bounces off the left wall", () => {
    const s = playing();
    placeBall(s, { x: 10, y: 250, vx: -200, vy: 0 });
    run(s, {}, 0.2);
    expect(s.ball.vx).toBeGreaterThan(0);
    expect(s.ball.x).toBeGreaterThan(0);
  });

  it("bounces off the right wall", () => {
    const s = playing();
    placeBall(s, { x: WIDTH - 10, y: 250, vx: 200, vy: 0 });
    run(s, {}, 0.2);
    expect(s.ball.vx).toBeLessThan(0);
    expect(s.ball.x).toBeLessThan(WIDTH);
  });

  it("bounces off the top wall", () => {
    const s = playing();
    clearBricks(s);
    s.bricks[0].alive = true;
    s.bricks[0].x = -100;
    placeBall(s, { x: 240, y: 20, vx: 0, vy: -200 });
    run(s, {}, 0.2);
    expect(s.ball.vy).toBeGreaterThan(0);
  });

  it("bounces off the paddle", () => {
    const s = playing();
    const centre = s.paddle.x + s.paddle.w / 2;
    placeBall(s, { x: centre, y: s.paddle.y - 30, vx: 0, vy: 200 });
    run(s, {}, 0.3);
    expect(s.ball.vy).toBeLessThan(0);
    expect(s.lives).toBe(3);
  });

  it("bounces off the paddle edge at an angle", () => {
    const s = playing();
    const rightEdge = s.paddle.x + s.paddle.w - 4;
    placeBall(s, { x: rightEdge, y: s.paddle.y - 20, vx: 0, vy: 200 });
    run(s, {}, 0.2);
    expect(s.ball.vy).toBeLessThan(0);
    expect(s.ball.vx).toBeGreaterThan(0);
  });
});

describe("bricks", () => {
  it("a brick breaks when the ball hits it and scores 10", () => {
    const s = playing();
    const brick = s.bricks[s.bricks.length - 1];
    placeBall(s, {
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h + 20,
      vx: 0,
      vy: -200,
    });
    run(s, {}, 0.2);
    expect(brick.alive).toBe(false);
    expect(s.score).toBe(BRICK_POINTS);
    expect(BRICK_POINTS).toBe(10);
    expect(bricksLeft(s)).toBe(BRICK_ROWS * BRICK_COLS - 1);
  });

  it("the ball bounces back off the brick it breaks", () => {
    const s = playing();
    const brick = s.bricks[s.bricks.length - 1];
    placeBall(s, {
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h + 20,
      vx: 0,
      vy: -200,
    });
    run(s, {}, 0.2);
    expect(s.ball.vy).toBeGreaterThan(0);
  });

  it("breaks only one brick per hit", () => {
    const s = playing();
    const brick = s.bricks[s.bricks.length - 1];
    placeBall(s, {
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h + 6,
      vx: 0,
      vy: -200,
    });
    step(s, {}, DT);
    expect(s.score).toBe(10);
  });
});

describe("lives", () => {
  it("missing the ball costs a life and puts the ball back on the paddle", () => {
    const s = playing();
    s.paddle.x = 0;
    placeBall(s, { x: 400, y: 300, vx: 0, vy: 300 });
    run(s, {}, 0.5);
    expect(s.lives).toBe(2);
    expect(s.status).toBe("playing");
    expect(s.ball.stuck).toBe(true);
    expect(s.ball.x).toBeCloseTo(s.paddle.x + s.paddle.w / 2);
  });

  it("Space launches the ball again after a lost life", () => {
    const s = playing();
    s.paddle.x = 0;
    placeBall(s, { x: 400, y: 300, vx: 0, vy: 300 });
    run(s, {}, 0.5);
    step(s, { launch: true }, DT);
    expect(s.ball.stuck).toBe(false);
  });
});

describe("win and lose", () => {
  it("breaking every brick wins", () => {
    const s = playing({ rows: 1, cols: 1 });
    const brick = s.bricks[0];
    placeBall(s, {
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h + 20,
      vx: 0,
      vy: -200,
    });
    run(s, {}, 0.2);
    expect(s.status).toBe("won");
    expect(s.score).toBe(10);
  });

  it("losing all lives ends the game", () => {
    let s = playing();
    for (let i = 0; i < 3; i++) {
      s.paddle.x = 0;
      placeBall(s, { x: 400, y: 300, vx: 0, vy: 300 });
      s = run(s, {}, 0.5);
    }
    expect(s.lives).toBe(0);
    expect(s.status).toBe("lost");
  });

  it("the game stays over until R is pressed", () => {
    const s = playing();
    s.status = "lost";
    run(s, { launch: true, right: true }, 0.5);
    expect(s.status).toBe("lost");
  });

  it("R restarts a fresh game", () => {
    const s = playing();
    s.score = 120;
    s.lives = 1;
    s.bricks[0].alive = false;
    const fresh = step(s, { restart: true }, DT);
    expect(fresh.status).toBe("ready");
    expect(fresh.score).toBe(0);
    expect(fresh.lives).toBe(3);
    expect(bricksLeft(fresh)).toBe(BRICK_ROWS * BRICK_COLS);
  });
});
