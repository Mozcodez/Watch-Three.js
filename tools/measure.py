# Object bbox + dark share (luma<80) inside it. Background = near-white low-saturation; floor shadow = grey low-sat
# pixels below the object, excluded by masking pale (luma>150) unsaturated pixels.
import sys
from PIL import Image
def measure(path, bg_luma=232):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    px = im.load()
    def luma(c): return 0.299*c[0]+0.587*c[1]+0.114*c[2]
    def sat(c): return max(c) - min(c)
    # object mask: not background (bright) and not pale grey shadow
    obj = lambda c: luma(c) < bg_luma - 0 and not (luma(c) > 150 and sat(c) < 14) or sat(c) > 40
    xs, ys = [], []
    cols = [0]*W; rows = [0]*H
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            if obj(px[x, y]): cols[x] += 1; rows[y] += 1
    thr = 3
    xi = [x for x in range(W) if cols[x] > thr]; yi = [y for y in range(H) if rows[y] > thr]
    x0, x1, y0, y1 = xi[0], xi[-1], yi[0], yi[-1]
    dark = tot = 0
    for y in range(y0, y1+1, 2):
        for x in range(x0, x1+1, 2):
            c = px[x, y]
            tot += 1
            if luma(c) < 80: dark += 1
    return dict(size=(W, H), bbox=(x0, y0, x1, y1), bw=x1-x0, bh=y1-y0, aspect=round((x1-x0)/(y1-y0), 3), dark=round(dark/tot, 4))
if __name__ == '__main__':
    for p in sys.argv[1:]: print(p.split('/')[-1], measure(p))
