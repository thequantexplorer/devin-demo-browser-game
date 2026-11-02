---
name: design
description: Visual design and game feel for the Breakout game. Read before drawing the game in src/main.js.
---

## Direction: neon arcade at night

The game should look and feel like a polished arcade game, not a demo of rectangles. Keep all of this in `src/main.js` and `src/style.css`. Do not change the game rules in `src/game.js` to get an effect.

- Page: full dark background `#05070D`. Center the canvas, scale it up to fit the window while keeping 480 x 360 proportions, and draw at `devicePixelRatio` so it stays sharp. Round the canvas corners (12 px) with a faint 1 px border `rgba(255,255,255,0.08)`.
- Background inside the canvas: a vertical gradient from `#0B1226` to `#05070D` with a faint grid (every 24 px, `rgba(255,255,255,0.03)`).
- Bricks: rounded rectangles (radius 4) with a soft glow (`shadowBlur` 12). One color per row, top to bottom: `#FF5A3C`, `#FF9F1C`, `#FFD23F`, `#7BE07B`, `#3ED1E6`. Add a light top highlight on each brick.
- Ball: white with a cyan glow and a short fading trail of its last 8 positions.
- Paddle: rounded, white to light cyan gradient, with a glow.
- Effects (visual only): when a brick breaks, burst 12 to 16 small particles in its color that fade out over 400 ms, and flash the score. When a ball is lost, shake the screen for 200 ms. When the game is won, the bricks' particles rain once.
- HUD: score top left and lives top right, in a monospace font (Geist Mono from Google Fonts, or `ui-monospace`), 16 px, letter-spacing `0.08em`. Show lives as small paddle shapes, not a number.
- Start, win and game over: a centered panel with a dark translucent background, a large title ("Breakout", "You win", "Game over"), the score, and "Press Space to start" or "Press R to play again" gently pulsing.
- Sound: short Web Audio blips for paddle hit, brick break, life lost and win. Start audio only after the first key press.

States to screenshot: the start screen, mid-game with some bricks broken and particles visible, the game over screen and the win screen (in a test build if needed).

## Rules for every screen

- One clear visual direction, used everywhere. No default framework or browser look (no unstyled inputs, no default blue links, no stock Material purple).
- Sans-serif type only. Use a real type scale with a few sizes, not many. Large, confident headings; quiet secondary text.
- Mostly neutral colors plus one accent. Use color for meaning (selected, done, error), not decoration. No purple or pink.
- Even spacing on an 8 px grid. Generous margins. Line up edges.
- Every interactive element has hover (or pressed), focus and disabled states.
- Design the empty state, the error state and the full state, not just one.
- Small, quick motion (150 to 250 ms) when things appear, change or finish.
- Support light and dark appearance if the platform has it, and check both.

## Check before you open the pull request

1. Take screenshots of every screen and state in the list above.
2. Look at each one at full size. Fix anything that is misaligned, cramped, clipped, low contrast or looks unfinished.
3. Put the final screenshots in the pull request description.
