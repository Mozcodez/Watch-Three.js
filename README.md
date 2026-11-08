# Verdant MW-1 — a robotic mechanical watch, built in Three.js

A skeleton mechanical watch in white ceramic with green accents, built **entirely in code** from one reference image
(`Futuristic White and Green Skeleton Watch.png`). Every part is real Three.js geometry: case, bezel, crystal, dial,
hands, going train, escapement, balance wheel, barrel, rotor, two crowns and an articulated 18-link bracelet,
with ~600 small parts (screws, pins, jewels, bearings). The movement runs: the balance beats at 4 Hz, the escape wheel
steps with it, the train turns at its own ratios, the hands keep time and the crown winds the barrel's ratchet.

From the same code the project makes:

| Output | Where | What it is |
|---|---|---|
| Interactive site | `out/dist/watch-site.html` | Open any part, take the watch apart, turn and zoom the camera, watch the films |
| Film | `out/watch-film.mp4` | 21.2 s, 1920×1080, 60 fps, with a synced score |
| Short | `out/watch-demo.mp4` | 10 s cut with its own script, with its score |
| Hero still | `out/r2/still.png` | The approved still (round 2), next to the reference in `out/r2/stack.png` |
| Vercel folder | `~/Projects/watch-site-deploy/` | The site + videos, ready for `vercel --prod` |

It was made with the **cutaway** workflow (`~/.claude/skills/cutaway`): measure the reference, build, render a still,
grade it against a checklist, fix, and only then film. The kit supplies the page runtime, the green page around the
watch, the build script and the sound engine.

## The brief

These files set the rules the watch was built and graded against:

| File | Holds |
|---|---|
| `Robotic Mechanical Watch.md` | The full brief: the look, the order of work, the camera, construction rules. User corrections are added here as permanent rules. |
| `checklist.txt` | The numbered lines each still is graded on (yes / partial / no) |
| `crop reference.txt` | The density test: dark-pixel share (luma < 80) inside the watch's box must reach 0.8 of the reference's |
| `loop.txt` | The still loop: render, stack against the reference, grade, fix; stop after round 2 for approval |
| `duration.txt` | The film's script: beat times for each part |
| `render.txt` | Capture and sound specs |

**Where the still landed (round 2):** dark share 0.235 vs the reference's 0.271 (0.87, passes); width/height 1.181 vs
1.185. Checklist lines 1, 2 and 7 graded yes. Line 5 and the thumbnail-density check were still partial: the
reference's green coils inside the case and its green-framed frosted bracelet panels are not visible yet.

## Project layout

```
watch-shared/        the watch and everything the outputs share
  watch.js           the model: every part, materials, explode directions, pose(state) as a pure function of time
  parts.js           shape helpers (rounded boxes, rings, gears, coils, tubes)
  stage.js           the studio: paper backdrop, lights, soft floor shadow, post-processing, quality settings
  guides.js          the faint construction guides drawn while parts are open
  tour.js            the film as functions of time: each beat's clock, its camera, the explode turntable, telemetry
  sim.js             the scene on the green page (pose, holder, cameras, page); runWatchFilm() for the films
  score.py           the score, built on the film's timeline
watch-still/main.js  the hero still page (camera from a --config JSON)
watch-film/          the film: main.js + timeline.json (beats from duration.txt)
watch-demo/          the 10 s short: its own timeline.json, 11.2 s of scene played at 1.12×
watch-site/main.js   the interactive page
tools/               render, measure, capture, encode and deploy scripts (below)
out/                 everything generated (stills, sheets, frames, videos, built pages)
```

### How the watch is built
- **Frame:** the wrist axis is X; the bracelet is a long oval loop in the YZ plane; the case sits on top with the dial
  facing +Y; the crowns point +X (3 o'clock).
- **Parts:** each part that comes apart is its own group with a named anchor and an explode direction. The movement's
  parts stack up the dial axis in order (train, barrel, escapement, bridges, chapter ring, hands, then bezel and
  crystal), so nothing passes through anything when it opens.
- **Density:** white surfaces are split into plates of three sizes with dark gaps over the mechanism: a six-plate top
  deck, three-plate lug horns, three-plate link rails over a graphite beam and a dark tray. Chrome pistons fill both
  flanks of the case.
- **Motion:** `pose({t, open, explode, wind})` sets everything from state alone, so any frame can be drawn at any
  time. The balance swings ±220° at 4 Hz, the pallet fork locks once a beat, the escape wheel steps 12° a beat, and
  the train runs 12× faster than real so the camera can see it turn.

### The film's beats (`watch-film/timeline.json`)
| t | Beat | Camera |
|---|---|---|
| 0 | Hero view, movement running | The approved still's view |
| 3.0 | Dial: crystal lifts, hands and chapter ring rise | Close, from above at an angle |
| 5.7 | Escapement: balance and escape wheel rise with the bridges | Steep close-up over the 7 o'clock side |
| 8.2 | Movement: lifts out of the case between the pistons | Low three-quarter view from the crown side |
| 10.8 | Crown: draws out and winds 3 turns | Side view down the crown's axis |
| 13.3 | Teardown: every part apart on a 360° turntable | Swings round and drops low |
| 16.5 | Reassembly | Swings back and pushes in |
| 17.7 | Hero | Settles into the hero view |

The tour is ported from the cutaway kit's piranha film: same beat times, same open / hold / close clocks.

## Requirements

- Node.js and the cutaway kit installed: `cd ~/.claude/skills/cutaway && npm install`
- Google Chrome at `/usr/bin/google-chrome` (the tools launch it with `--use-angle=gl` for real GPU rendering)
- Python 3 with Pillow (stills, sheets, frame downscaling, the score)
- ffmpeg (encoding)

## Commands

Run from this folder. Built pages go to `out/dist/`.

```bash
# build any entry
CUTAWAY_OUT=out node ~/.claude/skills/cutaway/sims/build.mjs ./watch-film ./watch-demo ./watch-site ./watch-still

# still: rebuild, render at t=0.6 with a camera config, and measure dark share + proportions
tools/r.sh out/r2/still.png out/r2/cam.json
tools/grid.sh out/grid.png '<cfg1>' '<cfg2>' ...      # up to 4 camera configs side by side
python3 tools/measure.py "Futuristic White and Green Skeleton Watch.png" out/r2/still.png

# review sheet of film frames
node tools/film.mjs out/dist/watch-film.html sheet 0,3.3,6,9,12,15,18 4 out/sheet.png

# frames → video
node tools/film.mjs out/dist/watch-film.html frames out/frames-1080 --dpr 1.2
TL=$PWD/watch-film/timeline.json OUT=$PWD/out/watch-score.wav python3 ~/.claude/skills/cutaway/run_sfx.py $PWD/watch-shared/score.py
FRAMES=out/frames-1080 tools/encode.sh

# the short: score its 11.2 s scene, stretch to 10 s, encode
node tools/film.mjs out/dist/watch-demo.html frames out/frames-demo --dpr 1.2
TL=$PWD/watch-demo/timeline.json OUT=$PWD/out/watch-demo-scene.wav python3 ~/.claude/skills/cutaway/run_sfx.py $PWD/watch-shared/score.py
ffmpeg -y -i out/watch-demo-scene.wav -af atempo=1.12 out/watch-demo-score.wav
FRAMES=out/frames-demo SCORE=out/watch-demo-score.wav OUT=out/watch-demo.mp4 tools/encode.sh

# site → Vercel folder, then deploy
tools/deploy-sync.sh
cd ~/Projects/watch-site-deploy && vercel --prod
```

### Tools
| Script | Does |
|---|---|
| `tools/r.sh` | Rebuild the still page, render one still, measure it |
| `tools/grid.sh` | Render up to 4 camera/pose configs into a 2×2 grid, measuring each |
| `tools/still.mjs` | Render the still page at given times to PNG |
| `tools/measure.py` | Object box, width/height and dark-pixel share of a picture |
| `tools/film.mjs` | Drive a film page: `sheet` (tiled review frames), `frames` (every frame as PNG, Lanczos to 1080p), `video` |
| `tools/encode.sh` | Frames + score → H.264 MP4 (60 fps, yuv420p, faststart, AAC 256k) |
| `tools/deploy-sync.sh` | Rebuild the site and refresh the Vercel folder with the page, videos and posters |
| `tools/probe.mjs`, `tools/box.mjs` | Debug: page load / GPU check; bounding boxes of the watch's parts |

## The interactive site

- **Dial, Escapement, Movement, Crown:** open that part under its own camera; it stays open until another button is pressed
- **Teardown:** explode the watch on a slow turntable; press again to put it back
- **Hero:** close everything and reset the view
- **Mouse:** drag to turn, scroll to zoom, double-click to reset. **Keys:** `1`–`4`, `E`, `H`
- **Films:** a player with the film and the short (served from `videos/` next to the page, so it needs to be on a web server such as Vercel)

The site steps its rendering quality down at runtime until it holds ~24 fps: ambient occlusion off, then MSAA and
self-shadows, then glass transmission, then resolution. A fast GPU keeps the film's full look.

## Known limits

- **Capture resolution:** `render.txt` asks for capture at 3840×2160 brought down to 1080p. On this machine's Intel UHD
  600 that runs 50–90 s a frame (~18–30 h for the film), so the delivered videos were captured directly at 1920×1080.
  For the 4K pass: `node tools/film.mjs out/dist/watch-film.html frames out/frames --dpr 2.4`, then `tools/encode.sh`.
- **The kit's `capture.mjs`** falls back to software rendering here (no `--use-angle=gl`), so this project uses
  `tools/film.mjs` instead.
- **Views not in the film:** the brief lists rear-case, bracelet-underside and clasp views, but the script in
  `duration.txt` has no beats for them.
- **Mid-reassembly frame:** for under a second in the film (~16.8 s) and the short (~6.2 s) the turntable has the watch
  edge-on and the bracelet reaches behind the page title.
- `out/frames-1080/` and `out/frames-demo/` (~1.8 GB) are only needed to re-encode and can be deleted.
