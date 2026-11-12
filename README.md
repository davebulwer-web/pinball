# Pixel Pinball

A pixel art pinball engine for the browser and phones, and the themed tables built on it. A companion to
[Fruit Machines](https://github.com/davebulwer-web/fruitmachines), set up the same way: plain JavaScript,
built into single HTML pages that work offline.

| Table | Status |
| --- | --- |
| Feel Test | Grey test table for tuning the ball, flippers, plunger and camera |
| Fun Fair | Planned (first themed table) |

## Play

Build, then open `dist/index.html` (the table menu) or a table's page such as `dist/test.html`.

| Action | Touch | Keyboard |
| --- | --- | --- |
| Start | Tap | Space |
| Flippers | Hold the left or right half of the screen | Z and / (or Shift, or Ctrl) |
| Launch | Hold anywhere and pull down, then let go (longer or further is stronger) | Hold Space (or Down), release |
| Nudge | Quick swipe up (up and sideways for a side nudge) | Arrow keys |
| Pause | Tap the score strip | P or Esc |

Too many nudges in four seconds gives DANGER, then TILT (flippers die until the ball drains).
M mutes, D shows the collision shapes. Add `?debug` to the page address to start with them shown,
or `?tune` for sliders that change gravity, flipper speed, bounce and kick strength while you play.

## Layout

- `engine/`: physics and game rules, no drawing code (runs headless in tests)
  - `physics.js`: ball, walls (segments, arcs, circles), moving surfaces, fixed 480 Hz steps with sub-steps so a fast ball never passes through a wall
  - `table.js`: builds a table from its config and runs the game (balls, players, plunger, ball save, nudge, tilt, events)
  - `parts/`: one file per moving part (`flipper.js`, `plunger.js`)
- `ui/`: the shared screen
  - `shell.js`: canvas, scaling, scrolling camera, touch and keyboard, pause, tuning panel
  - `render.js`: draws walls and rails from the collision shapes, plus flippers, bumpers, lamps and balls
  - `dmd.js`: the dot-matrix score strip; `font.js`: the 5x7 pixel font
  - `sound.js`: the sound board (synthesised placeholders, each replaceable by an audio file)
- `tables/<id>/`: one folder per table (`config.js` holds layout, parts and rules; `main.js` starts it)
- `tables/index.js`: the list of tables
- `test/`: headless physics and gameplay tests

## Commands (Node 18 or newer)

- `npm install`, then `npm run build`: builds `dist/`
- `npm test`: physics and gameplay tests, including a 15-minute bot game that checks no ball can get stuck

## Replacing sounds

Each sound has a name: flipper, bumper, sling, target, lane, knock, launch, drain, saved, nudge, danger,
tilt, start, over, award. A table can swap any of them for an audio file with `sounds: { bumper: 'url or data URI' }`
in its config.

## Plan

1. Feel test (this): physics, flippers, plunger, camera, touch controls on a grey table
2. Engine parts: drop targets, spinners, ramps and wire rails on layers, saucers, locks, multiball, kickback, the rules system
3. Fun Fair grey box: full layout and rules with placeholder drawing
4. Fun Fair art: Pixellab artwork, dot-matrix scenes, music
5. Finish: high scores, 1 to 4 players, attract mode, table menu, link from the Fruit Machine arcade
6. A second table
