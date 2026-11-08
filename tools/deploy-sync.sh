#!/bin/bash
# tools/deploy-sync.sh [dir] — rebuild the interactive page and refresh the Vercel folder (default ~/Projects/watch-site-deploy):
# index.html, videos/watch-film.mp4, videos/watch-demo.mp4 and a poster .jpg for each (the frame at 0.5 s).
set -e
cd "$(dirname "$0")/.."
D=${1:-$HOME/Projects/watch-site-deploy}
CUTAWAY_OUT=out node ~/.claude/skills/cutaway/sims/build.mjs ./watch-site | tail -1
mkdir -p "$D/videos"
cp out/dist/watch-site.html "$D/index.html"
for v in watch-film watch-demo; do
  cp "out/$v.mp4" "$D/videos/$v.mp4"
  ffmpeg -hide_banner -loglevel error -y -ss 0.5 -i "out/$v.mp4" -frames:v 1 -q:v 3 "$D/videos/$v.jpg"
done
echo "→ $D (run: cd $D && vercel --prod)"
