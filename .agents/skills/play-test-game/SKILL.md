---
name: play-test-game
description: Set up, run and play-test the Breakout game in the browser with the keyboard. Use when building the game and before opening a pull request that changes it.
---

## Stack

- Vite with plain JavaScript and an HTML canvas. No framework. Node 20.19 or newer.
- `src/game.js`: the game rules (`createGame()` and `step(state, input, dt)`), with no DOM or canvas code, so it can be unit tested with Vitest.
- `src/main.js`: draws the game on the canvas and reads the keyboard. `src/style.css`: the page.
- `npm test` runs `vitest run`.

## Setup

1. Run `npm install`.
2. Run `npm test` and `npm run build`. Both must pass.

## Play it

1. Run `npm run dev` in its own shell. Wait for `Local: http://localhost:5173/`.
2. Open http://localhost:5173 in the browser.
3. Click the page once so it has keyboard focus.
4. Play with real key presses: Left/Right arrows (or A/D) move the paddle, Space launches the ball, R restarts.
5. Check that bricks break, the score goes up by 10 per brick, a missed ball costs a life, and R starts a new game.

Do not change the game state from code or the browser console while play-testing.
