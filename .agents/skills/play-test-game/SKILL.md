---
name: play-test-game
description: Run the Breakout game locally and play it in the browser with the keyboard. Use before opening a pull request that changes the game.
---

## Setup

1. Use Node 20.19 or newer (`.nvmrc` says 22).
2. Run `npm install`.
3. Run `npm test` and `npm run build`. Both must pass.

## Play it

1. Run `npm run dev` in its own shell. Wait for `Local: http://localhost:5173/`.
2. Open http://localhost:5173 in the browser.
3. Click the page once so it has keyboard focus.
4. Play with real key presses: Left/Right arrows (or A/D) move the paddle, Space launches the ball, R restarts.
5. Check that bricks break, the score goes up by 10 per brick, a missed ball costs a life, and R starts a new game.

Do not change the game state from code or the browser console while play-testing.
