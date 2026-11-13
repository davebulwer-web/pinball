# Pixel Pinball

A pixel art pinball engine for the browser and phones, and the themed tables built on it. A companion to
[Fruit Machines](https://github.com/davebulwer-web/fruitmachines), set up the same way: plain JavaScript,
built into single HTML pages that work offline.

| Table | Status |
| --- | --- |
| Fun Fair | Full layout and rules with Pixellab artwork, dot-matrix scenes and a theme tune (F-U-N lanes and skill shot, dodgems, Big Wheel ramp, Rollercoaster rail, Hook a Duck, Big Top multiball, Coconut Shy, Ghost Train) |
| Parts Test | Grey table using every engine part: ramp, wire rail, drop targets, saucer lock, multiball, spinner, kickback, modes |
| Feel Test | Grey test table for tuning the ball, flippers, plunger and camera |

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
  - `rules.js`: the rules system: tables describe missions, lamps, combos and modes as data
  - `geom.js`: helpers for writing table shapes (arcs, joined paths, offset rails)
- `ui/`: the shared screen
  - `shell.js`: canvas, scaling, scrolling camera, touch and keyboard, pause, tuning panel
  - `render.js`: draws walls and rails from the collision shapes, plus flippers, bumpers, lamps and balls
  - `dmd.js`: the dot-matrix score strip; `font.js`: the 5x7 pixel font
  - `sound.js`: the sound board (synthesised placeholders, each replaceable by an audio file) and the chiptune music player
  - `art.js`: loads a table's inlined images
- `tables/<id>/`: one folder per table (`config.js` holds layout, parts and rules; `main.js` starts it).
  `tables/parts/config.js` is the reference: it uses every part and most rule features, and the header of
  `engine/table.js` lists every part's settings.
- `tables/funfair/`: also `art.js` (images to inline), `art/` (built images, with the Pixellab sources in `art/src/`),
  `scenes.js` (dot-matrix animations) and `music.js` (the theme tune)
- `art/gen.py`: makes an image with Pixellab (needs `PIXELLAB_API_KEY`); every prompt and seed is logged in
  `art/prompts/log.jsonl`. `art/compose_funfair.py` joins the Fun Fair backdrop panels and crops the sprites.
- `tables/index.js`: the list of tables
- `test/`: headless physics and gameplay tests

## Commands (Node 18 or newer)

- `npm install`, then `npm run build`: builds `dist/`
- `npm test`: physics, parts and rules tests, including long bot games that check no ball can escape or get stuck

## Parts

| Part | Config key | What it does |
| --- | --- | --- |
| Flipper | `flippers` | Player bat; passes its surface speed to the ball |
| Plunger | `plunger` | Launches the ball; pull length sets the power |
| Pop bumper | `bumpers` | Kicks the ball away |
| Slingshot | `slings` | Kicks sideways on a firm hit |
| Standup target | `targets` | Scores when hit |
| Drop target bank | `dropBanks` | Targets drop when hit; `bankDown` when all are down; resets after a delay |
| Rollover lane | `lanes` | Scores when rolled over |
| Spinner | `spinners` | Spins by the ball's speed, scores per turn |
| Saucer | `saucers` | Catches the ball, then kicks it out (rules can count it as a lock) |
| Kickback | `kickbacks` | Fires a ball back out of an outlane while its lamp is lit |
| Ramp or wire rail | `ramps` | Raised path on its own layer; slow balls are turned back at the mouth |
| One-way gate | `gates` | Solid from one side only |
| Lamp | `inserts` | A lamp painted on the playfield, lit by the rules |

## Rules

Rules are data in the table config, for example:

```js
{ on: 'bankDown:ducks', do: [['score', 2500], ['lamp', 'lock', 2], ['message', 'LOCK IS LIT']] },
{ on: 'saucer:hole', if: { lit: 'lock' }, do: [['lamp', 'lock', 0], ['lock'], ['event', 'lockCheck']] },
{ on: 'lockCheck', if: { locks: ['>=', 2] }, do: [['multiball', 3]], else: [['message', 'BALL LOCKED']] },
{ on: 'ramp:bigWheel', if: { after: ['ramp:coaster', 5] }, do: [['score', 10000], ['message', 'COMBO']] },
```

Triggers, conditions, actions, lamp groups and timed modes are listed at the top of `engine/rules.js`.
A drain pays the bonus times the multiplier; an extra ball gives a shoot again.

## Replacing sounds

Each sound has a name (the full list is at the top of `ui/sound.js`), such as flipper, bumper, sling,
drop, spin, ramp, multiball and jackpot. A table can swap any of them for an audio file with `sounds: { bumper: 'url or data URI' }`
in its config. Music works the same way: a table's `music` is a chiptune song written as notes (see
`tables/funfair/music.js`), and `sounds: { music: 'url' }` swaps it for a looping recording.

## Artwork

A table's look is three layers, so the art always matches where the ball goes:
1. a backdrop picture (`playfield` in the table's `art.js`), from Pixellab panels joined and dimmed by a compose script
2. rails, ramps, walls and slingshots, drawn by the engine from the collision shapes in the table's `colours`
3. sprites for parts: a bumper, drop bank or target with `art: 'name'` draws that image, `decals` place
   still pictures, and `bulbs` puts chasing lights along paths

## Plan

1. Feel test: physics, flippers, plunger, camera, touch controls on a grey table
2. Engine parts: drop targets, spinners, ramps and wire rails on layers, saucers, locks, multiball, kickback, the rules system
3. Fun Fair grey box: full layout and rules with placeholder drawing
4. Fun Fair art (this): Pixellab artwork, dot-matrix scenes, music
5. Finish: high scores, 1 to 4 players, attract mode, table menu, link from the Fruit Machine arcade
6. A second table
