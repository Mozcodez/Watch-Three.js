#!/bin/bash
# tools/r.sh <out.png> [config.json] — rebuild watch-still and render one still at t=0.6, then measure it
set -e
cd "$(dirname "$0")/.."
export CUTAWAY_OUT=out
node ~/.claude/skills/cutaway/sims/build.mjs ./watch-still 2>&1 | tail -1
node tools/still.mjs out/dist/watch-still.html "$1" 0.6 "${2:--}" | tail -1
python3 -I tools/measure.py "$1"
