# Devin demo: Build a browser game and play-test it

**What it shows:** Devin builds a Breakout game in an empty Vite app, plays it in its own browser with the keyboard, and adds a recording of real gameplay to the pull request.

**Needs:** GitHub only

More demos: [devin-advanced-demos](https://github.com/thequantexplorer/devin-advanced-demos)

## Set it up

1. Click **Use this template → Create a new repository**. Choose your GitHub account as the owner and keep the name `devin-demo-browser-game`. The prompt below assumes that name. Use the template, not a fork: pull requests on a fork go to the original repo.
2. In Devin, open [**Settings → Connections → GitHub**](https://app.devin.ai/settings/connections/github) and make sure Devin can access the new repository.

## Prompt

Open [app.devin.ai](https://app.devin.ai), start a new session and paste this. Replace `<you>` with your GitHub user.

```text
Build a Breakout game in https://github.com/<you>/devin-demo-browser-game. It is an empty Vite app. README.md has the game rules and the shape of the game state. The tests in src/game.test.js fail because src/game.js is not written yet.

Follow the design skill in .agents/skills/design/SKILL.md. The result should look like a finished, polished product, not a default template.

1. Write the game logic in src/game.js until npm test passes. Keep it free of DOM and canvas code.
2. In src/main.js, draw the game on the canvas: paddle, ball, bricks, score and lives. Use the keyboard: Left/Right arrows (and A/D) move the paddle, Space launches the ball, R restarts. Show "You win" or "Game over" with "Press R to play again".
3. Run npm run dev, open the game in your browser and play it with real key presses. Do not change the game state from code. Break some bricks, lose a ball, and restart. Fix anything that looks or feels wrong.
4. Open a pull request. Then record yourself playing one real round in the browser (break a few bricks, lose a ball, press R to restart) and add the recording to the pull request.
```

## What to look for

- `npm test` goes from 14 failing tests to all passing.
- Devin plays the game in its browser with the keyboard before it says it is done.
- The pull request has a recording of real gameplay, and the CI check is green.
