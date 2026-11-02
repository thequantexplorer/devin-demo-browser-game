import { describe, it, expect } from 'vitest';
import { createGame, step, WIDTH, HEIGHT } from './game.js';

const FRAME = 1 / 60;
const NO_KEYS = { left: false, right: false, launch: false };

function run(state, input, seconds) {
  let s = state;
  for (let t = 0; t < seconds; t += FRAME) s = step(s, input, FRAME);
  return s;
}

function lowestBrick(s) {
  return s.bricks.reduce((low, b) => (b.y > low.y ? b : low));
}

function playing() {
  const s = createGame();
  s.status = 'playing';
  return s;
}

describe('new game', () => {
  it('starts ready, with 0 points and 3 lives', () => {
    const s = createGame();
    expect(s.status).toBe('ready');
    expect(s.score).toBe(0);
    expect(s.lives).toBe(3);
  });

  it('has a wall of bricks in the top half of the screen', () => {
    const s = createGame();
    expect(s.bricks.length).toBeGreaterThan(0);
    for (const b of s.bricks) {
      expect(b.alive).toBe(true);
      expect(b.y + b.h).toBeLessThan(HEIGHT / 2);
    }
  });

  it('rests the ball on the middle of the paddle', () => {
    const s = createGame();
    expect(s.ball.y).toBeLessThan(s.paddle.y);
    expect(Math.abs(s.ball.x - (s.paddle.x + s.paddle.w / 2))).toBeLessThan(1);
  });
});

describe('paddle', () => {
  it('moves right and left with the keys', () => {
    const start = createGame().paddle.x;
    expect(run(createGame(), { ...NO_KEYS, right: true }, 0.2).paddle.x).toBeGreaterThan(start);
    expect(run(createGame(), { ...NO_KEYS, left: true }, 0.2).paddle.x).toBeLessThan(start);
  });

  it('stays on the screen', () => {
    expect(run(createGame(), { ...NO_KEYS, left: true }, 10).paddle.x).toBe(0);
    const right = run(createGame(), { ...NO_KEYS, right: true }, 10).paddle;
    expect(right.x + right.w).toBe(WIDTH);
  });

  it('carries the ball with it before launch', () => {
    const s = run(createGame(), { ...NO_KEYS, right: true }, 0.2);
    expect(s.status).toBe('ready');
    expect(Math.abs(s.ball.x - (s.paddle.x + s.paddle.w / 2))).toBeLessThan(1);
  });
});

describe('ball', () => {
  it('launches upward when launch is pressed', () => {
    const start = createGame();
    const startY = start.ball.y;
    let s = step(start, { ...NO_KEYS, launch: true }, FRAME);
    s = run(s, NO_KEYS, 0.1);
    expect(s.status).toBe('playing');
    expect(s.ball.y).toBeLessThan(startY);
  });

  it('bounces off the side walls', () => {
    const s = playing();
    Object.assign(s.ball, { x: s.ball.r + 1, y: HEIGHT * 0.6, vx: -300, vy: 0 });
    const after = run(s, NO_KEYS, 0.1);
    expect(after.ball.vx).toBeGreaterThan(0);
    expect(after.ball.x).toBeGreaterThan(s.ball.r);
  });

  it('bounces off the paddle', () => {
    const s = playing();
    const p = s.paddle;
    Object.assign(s.ball, { x: p.x + p.w / 2, y: p.y - s.ball.r - 2, vx: 0, vy: 300 });
    const after = run(s, NO_KEYS, 0.05);
    expect(after.ball.vy).toBeLessThan(0);
    expect(after.lives).toBe(3);
  });
});

describe('bricks and score', () => {
  it('breaks a brick, adds 10 points and bounces the ball back', () => {
    const s = playing();
    const brick = lowestBrick(s);
    const index = s.bricks.indexOf(brick);
    Object.assign(s.ball, { x: brick.x + brick.w / 2, y: brick.y + brick.h + s.ball.r + 2, vx: 0, vy: -300 });
    const after = run(s, NO_KEYS, 0.05);
    expect(after.bricks[index].alive).toBe(false);
    expect(after.bricks.filter((b) => b.alive).length).toBe(s.bricks.length - 1);
    expect(after.score).toBe(10);
    expect(after.ball.vy).toBeGreaterThan(0);
  });

  it('wins when the last brick breaks', () => {
    const s = playing();
    const brick = lowestBrick(s);
    s.bricks.forEach((b) => { b.alive = b === brick; });
    Object.assign(s.ball, { x: brick.x + brick.w / 2, y: brick.y + brick.h + s.ball.r + 2, vx: 0, vy: -300 });
    expect(run(s, NO_KEYS, 0.05).status).toBe('won');
  });
});

describe('lives', () => {
  function dropBall(s) {
    Object.assign(s.ball, { x: WIDTH / 2, y: HEIGHT + s.ball.r + 5, vx: 0, vy: 300 });
    return step(s, NO_KEYS, FRAME);
  }

  it('loses a life when the ball falls off the bottom, then waits for launch', () => {
    const after = dropBall(playing());
    expect(after.lives).toBe(2);
    expect(after.status).toBe('ready');
    expect(after.ball.y).toBeLessThan(after.paddle.y);
  });

  it('ends the game after the last life', () => {
    const s = playing();
    s.lives = 1;
    const after = dropBall(s);
    expect(after.lives).toBe(0);
    expect(after.status).toBe('lost');
  });

  it('freezes the game once it is over', () => {
    const s = playing();
    s.status = 'lost';
    const before = JSON.stringify(s);
    const after = run(s, { left: true, right: false, launch: true }, 0.5);
    expect(JSON.stringify(after)).toBe(before);
  });
});
