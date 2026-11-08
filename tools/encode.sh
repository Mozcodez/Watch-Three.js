#!/bin/bash
# tools/encode.sh — encode $FRAMES (default out/frames) (1920x1080 PNGs from `node tools/film.mjs <page> frames out/frames --dpr 2.4`, captured
# at 3840x2160 and brought down with lanczos) with the score out/watch-score.wav into out/watch-film.mp4:
# 60 fps, H.264, yuv420p, faststart, AAC 256k. SCORE and OUT pick another cut (the short:
# FRAMES=out/frames-demo SCORE=out/watch-demo-score.wav OUT=out/watch-demo.mp4). Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg).
set -e
cd "$(dirname "$0")/.."
FF=${FFMPEG:-ffmpeg}
FRAMES=${FRAMES:-out/frames}
SCORE=${SCORE:-out/watch-score.wav}
OUT=${OUT:-out/watch-film.mp4}
"$FF" -y -framerate 60 -i "$FRAMES"/f%05d.png -i "$SCORE" \
  -map 0:v -map 1:a -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
echo "→ $OUT"
