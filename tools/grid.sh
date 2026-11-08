#!/bin/bash
# tools/grid.sh <out.png> <cfg-json>... — render up to 4 configs into a 2x2 grid and measure each
cd "$(dirname "$0")/.."; P=$CLAUDE_JOB_DIR/tmp; out=$1; shift; i=0
for c in "$@"; do echo "$c" > $P/g$i.json; node tools/still.mjs out/dist/watch-still.html $P/g$i.png 0.6 $P/g$i.json >/dev/null; i=$((i+1)); done
python3 -I - "$out" $i <<PY
import sys; from PIL import Image
out,n=sys.argv[1],int(sys.argv[2]); s=Image.new('RGB',(1600,900),'white')
for i in range(n): s.paste(Image.open('$P/g%d.png'%i).resize((800,450)),((i%2)*800,(i//2)*450))
s.save(out)
PY
for k in $(seq 0 $((i-1))); do python3 -I tools/measure.py $P/g$k.png; done
