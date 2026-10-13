---
name: play-blockhaven
description: Play Blockhaven yourself in a headless browser - make a world (normal or One Piece), walk, jump, look around, mine, place, run chat commands, and take screenshots to see the game as a player does. Use when you need to see or feel how something in the game actually plays, playtest a change, reproduce a bug the user describes, check how a structure, creature or effect looks in the world, or explore a world before or after an update.
---

# Playing Blockhaven

`scripts/play.mjs` keeps one game open in headless Chromium between commands, so you can look,
think and act in turns like a player: act, read the state, look at a screenshot, decide, act again.

## Start, play, stop

```sh
P=.claude/skills/play-blockhaven/scripts/play.mjs
node $P serve            # run with run_in_background; serves the repo on :8123 if nothing is serving it
node $P "new 4242 onepiece survival; state; shot spawn"
node $P "turn 90; hold KeyW 2; state; shot ahead"
node $P quit             # when done (frees the browser and port 8130)
```

Several actions go in one call, separated by `;`. Every call prints one line per action. Read each
screenshot with the Read tool: that is how you see the game.

| Action | What it does |
|---|---|
| `new [seed] [onepiece] [creative\|survival]` | a new world, entered (render distance 6, sound off) |
| `hold <Key>[+Key] <secs>` | hold keys: `KeyW` forward, `KeyS` back, `KeyA`/`KeyD` strafe, `Space` jump/swim up, `ShiftLeft` sneak, `ControlLeft` sprint (`KeyW+ControlLeft`) |
| `tap <Key>` | one press: `Digit1`..`Digit9` hotbar, `KeyE` inventory, `KeyQ` drop, `Escape` |
| `turn <deg> [pitchDeg]` | turn right (negative: left); pitch up positive |
| `face <yaw> <pitch>` | look a set way |
| `mine [secs]` / `use [secs]` | left / right mouse button (break or attack / place, eat, open, ride) |
| `cmd /...` | any chat command; the game's reply is printed (`/give`, `/tp`, `/time set day`, `/locate town`, `/summon`, `/gamemode`) |
| `wait <secs>` | let the world run |
| `shot [name]` | screenshot to `/tmp/blockhaven-play/<name>.png` |
| `state` | position, facing, on ground / in water, health, food, held item, the block or creature under the crosshair (and how far), time, rain, creatures within 24 blocks |
| `eval <js>` | JavaScript in the page; `window.blockhaven` is the game (`.player`, `.world`, `.entities`, `.inv`, `.meta`) |
| `evalfile <path>` | a JavaScript file run in the page as the body of an async function (`return` the answer): for anything longer, or with `;` in it |

## Things to know

- The software-rendered browser runs the game several times slower than real time, so `hold`,
  `mine`, `use` and `wait` count **game** seconds: `hold KeyW 2` walks about 6 blocks, however long
  that takes. Keep held durations short and check `state` often.
- Keys go in as real keyboard events, as a person's keyboard sends them; looking is set directly
  (there is no mouse pointer lock headless).
- To get somewhere far, `cmd /tp x y z` or `cmd /locate ...` then `/tp`, then wait a moment for
  chunks before a screenshot (`wait 2`).
- For a flying camera in Creative, `eval window.blockhaven.player.flying = true`.
- Page errors and console errors are printed after the actions that caused them: treat any as a bug.
- The server shows the working tree's code. After editing source files, `new` reloads the page, so
  a fresh world picks the edits up.
- Options: `serve --port 8130 --url http://127.0.0.1:8123/index.html --width 960 --height 540 --out /tmp/blockhaven-play`.
