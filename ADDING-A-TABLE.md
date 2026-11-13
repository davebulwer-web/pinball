# Adding a table

A table is a folder in `tables/` plus one line in `tables/index.js`. Most tables need no engine code: they
reuse the parts and the rules system with a new layout, new rules and new art. The menu, high scores,
1 to 4 players, the instructions screen, sound and music all come with the shared screen in `ui/`.

## 1. Copy a table

Copy `tables/funfair/` or `tables/raceday/` to `tables/<your-id>/` (or `tables/parts/` to start from plain grey). Then:

- In `config.js`, set `id` (the folder name), `name` and `tagline` (one line for the menu).
- Add it to `tables/index.js`: import its config and put it in `tables`, in menu order.
- Set `workshop: true` for a test table. It is listed under Workshop in the menu of a developer build
  (`npm run build:dev`), with no picture, and left out of the normal build.

## 2. Layout (`config.js`)

The table is 320 pixels wide and usually 640 tall (`size`). The view scrolls to follow the ball, so the
whole table never has to fit on screen.

- Walls, posts and rails are lists of points. `engine/geom.js` has helpers for arcs, joined paths and
  rails a set distance apart.
- Each part has its own key: `flippers`, `plunger`, `bumpers`, `slings`, `targets`, `dropBanks`, `lanes`,
  `spinners`, `saucers`, `kickbacks`, `ramps`, `gates`, `inserts`, `toys`. All of their settings are listed at the
  top of `engine/table.js`. `tables/parts/config.js` uses every one of them.
- In a developer build (`npm run build:dev`), press D while playing (or add `?debug` to the address) to see the collision shapes. Add `?tune` for
  sliders that change gravity, flipper speed, bounce and kick strength while you play.

Lessons from the first tables:

- End inlane guides just above the flipper pivot, or a ball comes to rest on the pivot.
- Give flat-topped parts a peaked back or a slant, or a ball can rest on top.
- Lean ramp mouths toward the flippers, make the mouth wider than the ramp, and set `assist`. Then
  measure: about 20 to 25% of flip timings should make each ramp.
- A saucer behind drop targets needs a funnel, a catch radius `R`, and targets that stay down
  (`resetDelay: null`), or it is almost never hit.
- Side orbits should feed the inlanes, not the outlanes. Only use an outlane with a kickback.
- Test an upper flipper with live balls fed down to it, not by cradling: it is usually angled so a ball
  rolls straight off. Put its targets where its shots actually go (Race Day's shots go up and to the left).
- Check what a shot reaches with a sweep: Race Day's first scoop spot by the left orbit was almost never
  hit, because the ramp's funnel blocks every shot between the ramp and the orbit.

## 3. Rules

Rules are data: when something happens (`on`), check a condition (`if`), then do things (`do`). For example:

```js
{ on: 'bankDown:ducks', do: [['score', 2500], ['lamp', 'lock', 2], ['message', 'LOCK IS LIT']] },
```

Triggers, conditions, actions, lamp groups and timed modes are listed at the top of `engine/rules.js`.
`tables/funfair/config.js` has a full set: missions, locks and multiball, a jackpot, combos, a timed mode,
an extra ball and a skill shot.
`tables/raceday/config.js` adds a hurry-up, a mystery award, picking a horse with the flippers, a race run
by the game (its horses are `toys`), add-a-ball and a super jackpot.
`tables/highnoon/config.js` has a shootout written as functions: the flipper buttons fire pistols at figures
drawn by a `toys` entry with a `draw` function, while a saucer holds the ball and `game.lookAt` shows the
bottom of the table. It also has a moving target (`move` on a target) and a captive ball (`captives`).
`tables/cupfinal/config.js` has a goalkeeper (`move: { follow: true }`), a timed match shown on the dot
matrix with `status`, and two games played on the dot matrix (`game.video`) with the flipper buttons.
`tables/starsiege/config.js` has `fields`: a vortex (the black hole) and a magnet (the tractor beam), and a
space shooter on the dot matrix that its `script` tick moves along.
`tables/holeinone/config.js` has `sand` and `wind` fields, a round of holes kept in the player's `counts`,
and two more dot-matrix games.
`tables/grandslam/config.js` has innings, outs and runners on base kept by the table (the runners are a `toys`
entry that draws itself), and two more dot-matrix games.

## 4. Instructions

`instructions` adds pages after the controls page on the instructions screen (the ? button, or H):

```js
instructions: [
  { title: 'THE BIG TOP', items: [
    { art: 'lamp-tent', text: 'SHOOT THE BIG TOP WHEN IT IS LIT TO LOCK A BALL.' },
    { marquee: 'F', text: 'LIGHT F-U-N IN THE TOP LANES TO RAISE THE BONUS MULTIPLIER.' },
  ] },
],
```

Each item can show a picture from the table's art (`art`) or a bulb letter (`marquee`). Keep a page to
about five items so it fits on a short screen.

## 5. Art

A table's look is three layers, so the art always matches where the ball goes:

1. A backdrop picture: `playfield` in the table's `art.js`. Fun Fair's is made from Pixellab panels
   joined and dimmed by `art/compose_funfair.py`.
2. Rails, ramps, walls and slingshots, drawn by the engine from the collision shapes, in the table's
   `colours`.
3. Sprites for parts. A bumper, drop bank or target with `art: 'name'` draws that image, an insert with
   `art` is a picture lamp, `decals` place still pictures and `bulbs` puts chasing lights along paths.

To make a picture: `python3 art/gen.py out.png 64 64 "a red dodgem car, top down"` (it needs
`PIXELLAB_API_KEY`; `BG=1` makes a full backdrop panel instead of a sprite). Every prompt and seed is logged in
`art/prompts/log.jsonl`. Pixellab's smallest size is 32 pixels, so generate small icons at 32 and shrink them.
Run about three calls at a time, because more get turned away.

List each image in the table's `art.js` (name to file). The build inlines them, and `main.js` loads them
with `loadArt()` before starting the table. A table with no art needs no `art.js`; it is drawn in grey.

## 6. Display, sound and music

- `scenes`: dot-matrix animations for messages (see `tables/funfair/scenes.js`). A rule's
  `['message', 'TEXT', 'SUB', 'sceneName']` plays one. Message lines fit themselves: up to 26 letters in the
  normal font, up to 40 in a small one, and longer lines scroll (a single line too long is split over two).
  Keep lines short anyway, as the big letters read best.
- `dmd: { rows: 32 }`: a dot matrix twice as tall (160 x 32 dots), for more detailed scenes and bigger
  letters. It takes 32 more pixels from the top of the screen. See `tables/highnoon/scenes.js`.
- Flippers with `style: 'pistol'` are drawn as six-shooters with a muzzle flash; `flipSound: 'cap'` gives
  them a cap-gun snap. `style: 'bat'` draws baseball bats (Grand Slam), with `flipSound: 'bat'`.
- `music`: a chiptune song written as notes (see `tables/funfair/music.js`).
- `sounds`: swap any sound for an audio file, e.g. `sounds: { bumper: 'url or data URI', music: 'url' }`.
  The sound names are listed at the top of `ui/sound.js`.

## 7. High scores

The menu and the table keep the best five games on this device. A new table's list starts with five
made-up scores from 100,000 to 1,000,000. To start with scores that suit the table, set
`highScores: [['ACE', 2000000], ...]`. The list is stored per table `id`, so changing the id starts a new list.

## 8. Test and build

- Add a test file in `test/` (copy `test/funfair.test.js`). The bot game test plays long games and fails
  if a ball escapes the table or gets stuck.
- `npm test`, then `npm run build`.
- `node previews.cjs`, then `npm run build` again, to put the table's picture in the menu.
- Open `dist/index.html` and pick the table, or open `dist/<your-id>.html`.
