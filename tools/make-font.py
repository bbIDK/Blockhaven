#!/usr/bin/env python3
# Blockhaven's UI font: Monocraft (SIL OFL 1.1, Idrees Hassan) cut down to the characters the game
# shows, without its programming ligatures, and spaced like Minecraft's own font: each glyph as wide
# as its drawing plus one pixel, a space four pixels. Its 2 and Z, 8 and B look nothing alike,
# unlike those of the pixel font the game used before, and its S is redrawn so that it doesn't look
# like a 5 either (Minecraft's S is a 5 with its top-left corner off).
#
#   pip install fonttools brotli
#   python3 tools/make-font.py Monocraft.ttf src/fonts/blockhaven-pixel.woff2
#
# (Monocraft.ttf from https://github.com/IdreesInc/Monocraft, dist/Monocraft-ttf/Monocraft.ttf.)
import sys
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.pointInsidePen import PointInsidePen

src, out = sys.argv[1], sys.argv[2]
PX = 120  # one pixel in font units (1080 to the em: 9 pixels)
f = TTFont(src)
opts = subset.Options()
opts.layout_features = []          # (no ligatures: '->' stays two characters)
opts.name_IDs = ['*']
opts.notdef_outline = True
opts.hinting = False
opts.desubroutinize = True
text_ranges = list(range(0x20, 0x7f)) + list(range(0xa0, 0x180)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026,
    0x2190, 0x2191, 0x2192, 0x2193, 0x221e, 0x2122]
cmap = f.getBestCmap()
have = [u for u in text_ranges if u in cmap]
missing = [hex(u) for u in text_ranges if u not in cmap]
sub = subset.Subsetter(opts)
sub.populate(unicodes=have)
sub.subset(f)

glyf, hmtx = f['glyf'], f['hmtx']
gs = f.getGlyphSet()
cmap = f.getBestCmap()

# ---- Pixel editing: a glyph as a set of (x, y) pixels, with y = 0 the row on the baseline.
def pixels(name):
    b = glyf[name]
    b.recalcBounds(glyf)
    out = set()
    for y in range(b.yMin // PX - 1, b.yMax // PX + 1):
        for x in range(b.xMin // PX - 1, b.xMax // PX + 1):
            pen = PointInsidePen(gs, ((x + 0.5) * PX, (y + 0.5) * PX))
            gs[name].draw(pen)
            if pen.getResult():
                out.add((x, y))
    return out

def from_pixels(px):
    # The outlines around a set of pixels, clockwise (TrueType's way round for ink); pixels that
    # only touch at a corner get outlines of their own that meet at that corner.
    edges = set()
    for x, y in px:
        for a, b in (((x, y), (x, y + 1)), ((x, y + 1), (x + 1, y + 1)), ((x + 1, y + 1), (x + 1, y)), ((x + 1, y), (x, y))):
            if (b, a) in edges:
                edges.remove((b, a))  # (between two pixels: not an edge)
            else:
                edges.add((a, b))
    nxt = {}
    for a, b in edges:
        nxt.setdefault(a, []).append(b)
    pen = TTGlyphPen(None)
    while nxt:
        start = min(nxt)
        loop, at, came = [start], start, None
        while True:
            outs = nxt[at]
            if len(outs) > 1 and came:
                # (At a corner two pieces share, turn right: round the piece we're on.)
                d = (at[0] - came[0], at[1] - came[1])
                right = (at[0] + d[1], at[1] - d[0])
                b = right if right in outs else outs[0]
            else:
                b = outs[0]
            outs.remove(b)
            if not outs:
                del nxt[at]
            came, at = at, b
            if at == start:
                break
            loop.append(at)
        # Only the corners.
        pts = [p for i, p in enumerate(loop)
               if (p[0] - loop[i - 1][0]) * (loop[(i + 1) % len(loop)][1] - p[1]) != (p[1] - loop[i - 1][1]) * (loop[(i + 1) % len(loop)][0] - p[0])]
        pen.moveTo((pts[0][0] * PX, pts[0][1] * PX))
        for x, y in pts[1:]:
            pen.lineTo((x * PX, y * PX))
        pen.closePath()
    return pen.glyph()

def rows(*art):
    # Pixels from rows of # and . (the top row first; the last row sits on the baseline).
    return {(x, len(art) - 1 - r) for r, line in enumerate(art) for x, c in enumerate(line) if c == '#'}

# S, and the S under an accent: Minecraft's S is a 5 but for two pixels, so it gets a shape of its
# own, the same both ways up, like the small s.
OLD_S = rows('.####', '#....', '.###.', '....#', '....#', '#...#', '.###.')
NEW_S = rows('.####', '#....', '#....', '.###.', '....#', '....#', '####.')
for u in (0x53, 0x15a, 0x15c, 0x15e, 0x160, 0x218):
    name = cmap.get(u)
    if not name:
        continue
    px = pixels(name)
    x0 = min(x for x, y in px if 0 <= y <= 6)
    body = {(x - x0, y) for x, y in px if 0 <= y <= 6}
    if body != OLD_S:
        sys.exit(f'{name}: not the S expected')
    glyf[name] = from_pixels({p for p in px if not 0 <= p[1] <= 6} | {(x + x0, y) for x, y in NEW_S})
gs = f.getGlyphSet()
space = {cmap.get(0x20), cmap.get(0xa0)}
for name in f.getGlyphOrder():
    g = glyf[name]
    if name in space:
        hmtx[name] = (4 * PX, 0)
        continue
    if g.numberOfContours == 0:
        continue
    g.recalcBounds(glyf)
    x0, x1 = g.xMin, g.xMax
    # Redraw it (components and all) moved to start at x = 0, on the pixel grid.
    shift = -round(x0 / 60) * 60
    pen = TTGlyphPen(gs)
    gs[name].draw(TransformPen(pen, (1, 0, 0, 1, shift, 0)))
    ng = pen.glyph()
    ng.recalcBounds(glyf)
    glyf[name] = ng
    width = x1 - x0
    hmtx[name] = (int(round((width + PX) / 60) * 60), 0)
if 'GPOS' in f: del f['GPOS']
if 'GSUB' in f: del f['GSUB']
f['OS/2'].xAvgCharWidth = 600
f['post'].isFixedPitch = 0
f['OS/2'].panose.bProportion = 0
# Renamed, as the licence asks of a changed version, and with the licence in it (the single-file
# build carries the font inside it, without the licence file beside it).
for rec in f['name'].names:
    if rec.nameID in (1, 3, 4, 6, 16):
        rec.string = {1: 'Blockhaven Pixel', 3: 'Blockhaven Pixel (Monocraft)', 4: 'Blockhaven Pixel', 6: 'BlockhavenPixel', 16: 'Blockhaven Pixel'}[rec.nameID]
f['name'].setName('Copyright (c) 2022, Idrees Hassan (https://github.com/IdreesInc/Monocraft)', 0, 3, 1, 0x409)
f['name'].setName('This Font Software is licensed under the SIL Open Font License, Version 1.1. It is Monocraft, changed for '
                  'Blockhaven: fewer characters, spaced like Minecraft\'s font, and a new S.', 13, 3, 1, 0x409)
f['name'].setName('https://openfontlicense.org', 14, 3, 1, 0x409)
f.flavor = 'woff2'
f.save(out)
print('glyphs', len(f.getGlyphOrder()), 'missing', missing)
