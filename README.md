# Pixel Pinball

A pixel art pinball engine for the browser and phones, and the themed tables built on it. A companion to
[Fruit Machines](https://github.com/davebulwer-web/fruitmachines), set up the same way: plain JavaScript,
built into single HTML pages that work offline.

| Table | Status |
| --- | --- |
| Fun Fair | Full layout and rules with Pixellab artwork, dot-matrix scenes and a theme tune (F-U-N lanes and skill shot, dodgems, Big Wheel ramp, Rollercoaster rail, Hook a Duck, Big Top multiball, Coconut Shy, Ghost Train) |
| Race Day | Full layout and rules with Pixellab artwork, dot-matrix scenes and a theme tune (B-E-T lanes and skill shot, an upper flipper, the Stables scoop with a subway, pick-your-horse races on a race track toy, the Home Straight ramp, the Fences and a Jump Off hurry-up, the Bookie's Tip mystery award, the Paddock diverter and bumpers, the Lucky Horseshoe up-post, Grand National multiball with add-a-ball and a super jackpot) |
| High Noon | Wild West table with a tall 160 x 32 dot matrix, Pixellab artwork and a cowboy theme tune. Six-shooters for flippers that really fire in the Quick Draw (outlaws pop up across the bottom of the table), a Stagecoach moving target, the Bank captive ball, the Jail scoop and Jailbreak multiball, the Railroad wire ramp, the Saloon scoop, WANTED drop targets, Gold Rush, and a kickback |
| Cup Final | Football table with a tall dot matrix: a goalkeeper who moves across to block your shots, 60-second matches against a rival through four rounds of the cup (the match score is on the dot matrix), two games played on the dot matrix with the flipper buttons (a penalty shootout and keepy-uppy), the Cross ramp for headers, the Wall drop targets, a Golden Boot extra ball and Cup Final multiball |
| Star Siege | Space battle table with a tall dot matrix: an alien mothership that patrols the top behind three shield drop targets (knock them down, then hit it five times), the Dogfight (a space shooter on the dot matrix, flown with the flipper buttons), a black hole that swirls the ball round, a tractor beam that catches the ball and throws it at the mothership, Hyperspace ramp jumps, Hangar locks and Fleet Launch multiball, Event Horizon and Warp Speed |
| Parts Test | Grey table using every engine part: ramp, wire rail, drop targets, saucer lock, multiball, spinner, kickback, modes |
| Feel Test | Grey test table for tuning the ball, flippers, plunger and camera |

## Play

Build, then open `dist/index.html`: the table menu, with every table in one page that works offline. Pick a
table to play it; `index.html#funfair` opens one straight away. Each table also has its own page, such as
`dist/funfair.html`. When this project and [Fruit Machines](https://github.com/davebulwer-web/fruitmachines)
sit side by side (in one folder, or both on GitHub Pages), the menu links to the Fruit Machine Arcade.

Between games, pick 1 to 4 players with the buttons on the table (or keys 1 to 4; a tap or Space starts a
one-player game). Players take turns, three balls each. The best five scores on each table are kept on the
device: a score that makes the list asks for a three-letter name, and the list shows after each game and
every so often while the table waits. The "< TABLES" button (or Esc) goes back to the menu, and the ? button
(or H) opens the rules.

| Action | Touch | Keyboard |
| --- | --- | --- |
| Start | Tap (or a 1 to 4 players button) | Space (or 1 to 4 for players) |
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
  - `help.js`: the instructions screen; `screens.js`: player buttons, high score table and name entry;
    `scores.js`: the high score lists (kept in the browser, per table)
  - `lobby.js` and `lobby.html`: the table menu
  - `sound.js`: the sound board (synthesised placeholders, each replaceable by an audio file) and the chiptune music player
  - `art.js`: loads a table's inlined images
- `tables/<id>/`: one folder per table (`config.js` holds layout, parts and rules; `main.js` starts it).
  `tables/parts/config.js` is the reference: it uses every part and most rule features, and the header of
  `engine/table.js` lists every part's settings.
- `tables/funfair/`: also `art.js` (images to inline), `art/` (built images, with the Pixellab sources in `art/src/`),
  `scenes.js` (dot-matrix animations) and `music.js` (the theme tune)
- `art/gen.py`: makes an image with Pixellab (needs `PIXELLAB_API_KEY`); every prompt and seed is logged in
  `art/prompts/log.jsonl`. `art/compose_funfair.py`, `art/compose_raceday.py`, `art/compose_highnoon.py`, `art/compose_cupfinal.py` and `art/compose_starsiege.py` join each table's backdrop panels and crop the sprites.
- `tables/index.js`: the list of tables, in menu order. [ADDING-A-TABLE.md](ADDING-A-TABLE.md) explains how to make a new one.
- `previews.cjs`: takes each table's picture for the menu (`tables/<id>/preview.png`)
- `test/`: headless physics and gameplay tests

## Commands (Node 18 or newer)

- `npm install`, then `npm run build`: builds `dist/` (the menu, a page per table, and artifact pages)
- `node previews.cjs`, then build again: updates the table pictures in the menu
- `npm test`: physics, parts and rules tests, including long bot games that check no ball can escape or get stuck

## Parts

| Part | Config key | What it does |
| --- | --- | --- |
| Flipper | `flippers` | Player bat; passes its surface speed to the ball. Add more for upper flippers: every flipper on a side moves together |
| Plunger | `plunger` | Launches the ball; pull length sets the power |
| Pop bumper | `bumpers` | Kicks the ball away |
| Slingshot | `slings` | Kicks sideways on a firm hit |
| Vortex, magnet | `fields` | No collision: a vortex swirls a ball passing near it round (Star Siege's black hole); a magnet, switched on by `['magnet', id, secs]`, pulls a ball in, holds it and throws it out (the tractor beam) |
| Standup target | `targets` | Scores when hit. With `move` it slides to and fro (High Noon's Stagecoach), or with `move: { follow }` it moves to block the ball (Cup Final's goalkeeper) |
| Captive ball | `captives` | A ball that stays in its channel (walls with `captiveOnly`); hit it to knock it into a target |
| Drop target bank | `dropBanks` | Targets drop when hit; `bankDown` when all are down; resets after a delay |
| Rollover lane | `lanes` | Scores when rolled over |
| Spinner | `spinners` | Spins by the ball's speed, scores per turn |
| Saucer | `saucers` | Catches the ball, then kicks it out (rules can count it as a lock). With `exit` it is a scoop with a subway: the ball comes out somewhere else |
| Kickback | `kickbacks` | Fires a ball back out of an outlane while its lamp is lit |
| Ramp or wire rail | `ramps` | Raised path on its own layer; slow balls are turned back at the mouth |
| One-way gate | `gates` | Solid from one side only |
| Diverter or up-post | `walls` or `posts` with an `id` | Raised and lowered by the rules; waits for a ball to move clear before it rises |
| Toy | `toys` | A picture the game state moves, such as Race Day's horses, or a `draw` function (High Noon's Quick Draw) |
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
Race Day adds hurry-ups (a mode with a falling value, scored by `collect`), mystery awards (`mystery`),
picking with the flippers while a saucer holds the ball (`hold` and a rotating lamp group), raising posts
(`post`) and add-a-ball (`addBall`).
High Noon's Quick Draw is written as functions in its config: the `flip:left` and `flip:right` triggers fire
the pistols, `game.lookAt` points the camera at the bottom of the table, and `releaseSaucer` lets the ball go.
Cup Final's penalty shootout and keepy-uppy are games on the dot matrix: `game.video = { draw(api, t) }` takes
over the display while a saucer holds the ball, and the flipper triggers play them. A table's `status(game)`
puts a line (the match score) under the score.
Star Siege's Dogfight is another `game.video` game, a side-scrolling shooter run from the table's `script` tick.
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
4. Fun Fair art: Pixellab artwork, dot-matrix scenes, music
5. Finish: high scores, 1 to 4 players, attract mode, table menu, link from the Fruit Machine arcade, ADDING-A-TABLE.md
6. A second table: Race Day, with the parts and rules Fun Fair doesn't use
7. A third table: High Noon, with pistol flippers, a moving target, a captive ball and a tall dot matrix
8. A fourth table: Cup Final, with a goalkeeper, timed matches and games on the dot matrix
9. A fifth table (this): Star Siege, with a black hole, a tractor beam and a space shooter on the dot matrix
