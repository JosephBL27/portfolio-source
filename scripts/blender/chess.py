# The chess table of the knight stop (src/v3/world/extras/cabinet/chess.ts): public/models/glb/chess-board.glb
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/chess.py -- public/models/glb/chess-board.glb
# The lacquered top (a transparent plane with the baked marble / walnut / inlay) and the pieces stay procedural. This is everything under and around the top, swept round
# the rounded rectangle of the board: a moulded walnut frame (cove, bead, fillets), brass beads (top, bottom) that follow the rounded corners, a dark chamfered pedestal.
# Parts: slab (walnut, UV: u round the perimeter / 6.88, v up), brass, base. Dimensions are chess.ts's: S = 0.7, W x DEPTH, the top at y = 0, SLAB 0.42 deep.
import bpy, bmesh, math, sys, os
sys.dont_write_bytecode = True   # Blender ignores PYTHONDONTWRITEBYTECODE; keeps __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

OUT = argv_out('public/models/glb/chess-board.glb')
setup(64)
S_ = 0.7
HB, BORDER, SIDE, BACK, FRONT = 4 * S_, 0.34, 0.3, 0.92, 0.96
W = 2 * (HB + BORDER + SIDE)
DEPTH = 2 * HB + 2 * BORDER + BACK + FRONT
CZ = (FRONT - BACK) / 2
SLAB = 0.42
BASE_H = 1.95
RC = 0.07

# walnut frame: (inset, y) from the bottom edge up to the top surface (y = 0)
slab_prof = [(0.05, -SLAB), (0.014, -SLAB + 0.012), (0.0, -SLAB + 0.045), (0.0, -0.31), (0.012, -0.29), (0.034, -0.265), (0.04, -0.235), (0.04, -0.205), (0.034, -0.185), (0.012, -0.165),
             (0.0, -0.145), (0.0, -0.075), (0.008, -0.045), (0.02, -0.016), (0.034, 0.0)]
bm = bmesh.new()
add_rect_sweep(bm, slab_prof, W, DEPTH, CZ, RC, uv_u=W)
slab = part('slab', bm, smooth_angle=0.9, dense=0.0)

# brass: a half-round bead along the top edge, a flat band low on the frame, and a turned cap at each corner of the base line
bm = bmesh.new()
add_rect_sweep(bm, [(-0.004, -0.074), (-0.02, -0.066), (-0.034, -0.04), (-0.02, -0.014), (-0.004, -0.006)], W, DEPTH, CZ, RC + 0.012)
add_rect_sweep(bm, [(-0.004, -SLAB + 0.036), (-0.014, -SLAB + 0.042), (-0.016, -SLAB + 0.06), (-0.014, -SLAB + 0.078), (-0.004, -SLAB + 0.084)], W, DEPTH, CZ, RC + 0.01)
brass = part('brass', bm, smooth_angle=0.7)

# the pedestal: a dark chamfered box under the frame (open at the top: the lacquered top is see-through, as before)
base_prof = [(0.17, -SLAB + 0.02), (0.17, -1.82), (0.14, -1.86), (0.1, -1.9), (0.1, -2.3), (0.13, -2.34), (0.2, -2.37)]
bm = bmesh.new()
add_rect_sweep(bm, base_prof, W, DEPTH, CZ, RC + 0.04)
base = part('base', bm, smooth_angle=0.5)

objs = [slab, brass, base]
bake_ao([slab, brass], dist=0.1, floor=0.55, smooth=2)
bake_ao([base], dist=0.3, floor=0.4, smooth=1)
export(OUT, objs, uv=True)
