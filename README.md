# devin-demo-browser-game

Breakout in the browser. It uses [Vite](https://vite.dev), plain JavaScript and an HTML canvas, with no framework.

```sh
npm install
npm run dev    # http://localhost:5173
npm test       # unit tests for the game logic
npm run build
```

## Files

- `src/game.js`: the game logic, `createGame()` and `step(state, input, dt)`. It has no DOM or canvas code, so it can be unit tested.
- `src/game.test.js`: Vitest tests for the game logic.
- `src/main.js`: draws the game on the canvas, plays sounds and reads the keyboard.
- `index.html`, `src/style.css`: the page.

## Game rules

The screen is `WIDTH` x `HEIGHT` (480 x 360) pixels. `(0, 0)` is the top left.

`createGame()` returns a new game:

```js
{
  status: 'ready',  // 'ready' | 'playing' | 'won' | 'lost'
  score: 0,
  lives: 3,
  paddle: { x, y, w, h },          // x, y is the top left corner
  ball: { x, y, r, vx, vy },       // x, y is the centre; vx, vy in pixels per second
  bricks: [{ x, y, w, h, alive }], // a wall of bricks in the top half of the screen
}
```

`step(state, input, dt)` moves the game forward by `dt` seconds and returns the new state. `input` is `{ left, right, launch }`, each `true` or `false`.

- Left and right move the paddle. The paddle never leaves the screen.
- While `ready`, the ball sits on the middle of the paddle and moves with it. Launch sends it upward and the status becomes `playing`.
- The ball bounces off the left, right and top walls, and off the paddle. Where the ball hits the paddle sets the bounce angle.
- When the ball hits a brick, the brick breaks (`alive: false`), the score goes up by 10, the ball bounces back and gets a little faster.
- When the last brick breaks, the status becomes `won`.
- When the ball falls off the bottom, you lose a life. If you have lives left, the status goes back to `ready`. If not, it becomes `lost`.
- Once the game is `won` or `lost`, `step` changes nothing. Start a new game with `createGame()`.

## Controls

- Left / Right arrow keys (or A / D): move the paddle
- Space: launch the ball
- R: restart
