# The turntable of the records stage (src/v3/world/extras/cabinet/records.ts): public/models/glb/turntable.glb
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/turntable.py -- public/models/glb/turntable.glb
# Site coordinates (see lib.py). The numbers below are the ones records.ts uses: plinth 5.2 x 0.5 x 4.1 on y 0.04, platter centre C, tonearm pivot P.
# Named parts (the site picks a material per name): plinth (walnut, UV), plate (brushed steel top), trim (feet, well ring, spindle, controls, screws),
# dark (rubber: skirt, foot rings, well floor), mat (felt slipmat), platter_body + platter_strobe (spin together about the spindle), armbase + armcap
# (static pillar), arm_metal + arm_dark + arm_cart (the arm, authored along +x from its pivot; the site yaws and lifts it).
import bpy, bmesh, math, sys, os
sys.dont_write_bytecode = True   # Blender ignores PYTHONDONTWRITEBYTECODE; keeps __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

OUT = argv_out('public/models/glb/turntable.glb')
setup(64)
CX, CZ = -0.55, 0.12          # platter centre
PX, PZ = 1.85, -1.3           # tonearm pivot
Y0 = 0.04                     # plinth foot line
TOP = 0.54                    # plinth top
PL_TOP = 0.555                # steel plate top
PLAT_Y = 0.50                 # platter centre height (0.44 .. 0.56)
ARM_Y = 1.06
ARM_L = 2.92
WELL = 1.66

def knurl(bm, verts, c, ridges, depth, rmin):
    cb = S(*c)
    for v in verts:
        d = v.co - cb
        # radial distance in the plane perpendicular to up (Blender Z)
        r = math.hypot(d.x, d.y)
        if r < rmin:
            continue
        k = 1 + depth * math.copysign(math.pow(abs(math.cos(math.atan2(d.y, d.x) * ridges)), 0.5), math.cos(math.atan2(d.y, d.x) * ridges))
        v.co.x = cb.x + d.x * k
        v.co.y = cb.y + d.y * k

def near_well(r=0.34):
    def f(p):
        return p[1] > 0.38 and abs(math.hypot(p[0] - CX, p[2] - CZ) - WELL) < r
    return f

def near_any(*fs):
    return lambda p: any(f(p) for f in fs)

def near_pt(x, z, r):
    return lambda p: p[1] > 0.5 and math.hypot(p[0] - x, p[2] - z) < r

def near_edge(hx, hz, r):
    return lambda p: p[1] > 0.52 and (abs(abs(p[0]) - hx) < r or abs(abs(p[2]) - hz) < r)

def well_cut(bm, y0=0.40):
    add_cyl(bm, (CX, y0 + 0.3, CZ), WELL, 0.6, 'y', segs=128)

# ---------------------------------------------------------------- plinth: walnut, rounded, with a pocket for the platter
bm = bmesh.new()
add_box(bm, (0, (0.11 + TOP) / 2, 0), (5.2, TOP - 0.11, 4.1), bevel=0.05, seg=4)
plinth = part('plinth', bm, uv=(5.2, 4.1))
boolean(plinth, well_cut)
redo_dense(plinth, 0.09, uv=(5.2, 4.1), coarse=0.9, near=near_any(near_well(0.28), near_edge(2.48, 1.93, 0.25), near_pt(PX, PZ, 0.9)))

# ---------------------------------------------------------------- the steel top plate (a pocket for the platter, screws, a printed speed scale)
bm = bmesh.new()
add_box(bm, (0, (TOP + PL_TOP) / 2, 0), (4.96, PL_TOP - TOP, 3.86), bevel=0.006, seg=2)
plate = part('plate', bm)
boolean(plate, well_cut)
bm = bmesh.new(); bm.from_mesh(plate.data)
for sx in (-2.34, 2.34):
    for sz in (-1.78, 0.0, 1.78):
        add_screw(bm, (sx, PL_TOP, sz), 0.05, 0.022, segs=20)
for k in range(5):                       # the engraved speed scale around the knob: five raised ticks
    a = -0.8 + k * 0.4
    add_box(bm, (-2.05 + math.sin(a) * 0.3, PL_TOP + 0.002, 1.55 - math.cos(a) * 0.3), (0.012, 0.004, 0.05), bevel=0)
bm.to_mesh(plate.data); bm.free()
redo_dense(plate, 0.09, coarse=0.9, near=near_any(near_well(0.32), near_pt(PX, PZ, 0.85), near_pt(-2.05, 1.55, 0.4), near_pt(-1.6, 1.62, 0.25), near_pt(-1.2, 1.62, 0.15), near_pt(-2.34, 0, 0.12), near_pt(2.34, 0, 0.12), near_pt(-2.34, -1.78, 0.12), near_pt(2.34, -1.78, 0.12), near_pt(-2.34, 1.78, 0.12), near_pt(2.34, 1.78, 0.12)))

# ---------------------------------------------------------------- trim: feet, the chrome ring round the well, spindle, controls, the arm's pad and screws
bm = bmesh.new()
for fx, fz in [(-2.3, -1.8), (2.3, -1.8), (-2.3, 1.8), (2.3, 1.8)]:
    add_lathe(bm, [(0, 0.0), (0.2, 0.0), (0.26, 0.015), (0.27, 0.06), (0.24, 0.08), (0, 0.08)], (fx, 0.0, fz), segs=40)
    add_screw(bm, (fx, 0.08, fz), 0.07, 0.02, segs=16)
ring = [(1.615, 0.50), (1.615, 0.566), (1.628, 0.576), (1.69, 0.576), (1.72, 0.564), (1.72, 0.50)]
add_lathe(bm, ring, (CX, 0, CZ), segs=128, closed=True)
add_lathe(bm, [(0, 0.60), (0.075, 0.60), (0.075, 0.616), (0.04, 0.626), (0.03, 0.64), (0.03, 0.94), (0.024, 0.975), (0.012, 0.995), (0, 0.998)], (CX, 0, CZ), segs=32)
# controls: a speed knob with a skirt and a knurled grip, a start / stop button in a bezel, a LED bezel
kc = (-2.05, PL_TOP, 1.55)
add_lathe(bm, [(0, 0), (0.235, 0), (0.24, 0.006), (0.236, 0.014), (0, 0.014)], kc, segs=64)
fv0 = len(bm.verts)
add_lathe(bm, [(0, 0.014), (0.2, 0.014), (0.205, 0.03), (0.17, 0.034), (0.17, 0.1), (0.15, 0.115), (0.09, 0.122), (0, 0.122)], kc, segs=96)
knurl(bm, list(bm.verts)[fv0:], kc, 20, 0.035, 0.168)
add_box(bm, (kc[0] + 0.0, kc[1] + 0.121, kc[2] - 0.095), (0.016, 0.006, 0.12), bevel=0.002, seg=1)
bc = (-1.6, PL_TOP, 1.62)
add_torus(bm, (bc[0], bc[1] + 0.004, bc[2]), 0.115, 0.014, 'y', 48, 8)
add_lathe(bm, [(0, 0.0), (0.1, 0.0), (0.1, 0.05), (0.09, 0.062), (0.05, 0.068), (0, 0.068)], bc, segs=48)
add_torus(bm, (-1.2, PL_TOP + 0.004, 1.62), 0.05, 0.01, 'y', 24, 6)
# the tonearm's pad, pillar, collar and the little anti-skate dial
add_box(bm, (PX, PL_TOP + 0.015, PZ), (0.96, 0.03, 0.96), bevel=0.012, seg=3)
for dx, dz in [(-0.38, -0.38), (0.38, -0.38), (-0.38, 0.38), (0.38, 0.38)]:
    add_screw(bm, (PX + dx, PL_TOP + 0.03, PZ + dz), 0.04, 0.02, segs=16)
add_lathe(bm, [(0, PL_TOP + 0.03), (0.37, PL_TOP + 0.03), (0.37, 0.61), (0.33, 0.64), (0.3, 0.7), (0.285, 0.9), (0.27, 0.905), (0.27, 0.93), (0.24, 0.935), (0.215, 0.94), (0, 0.94)], (PX, 0, PZ), segs=80)
add_torus(bm, (PX, 0.78, PZ), 0.29, 0.012, 'y', 80, 6)
add_torus(bm, (PX, 0.88, PZ), 0.28, 0.01, 'y', 80, 6)
ac = (PX + 0.66, PL_TOP, PZ + 0.38)
fv0 = len(bm.verts)
add_lathe(bm, [(0, 0), (0.105, 0), (0.108, 0.035), (0.09, 0.045), (0, 0.045)], ac, segs=48)
knurl(bm, list(bm.verts)[fv0:], ac, 16, 0.03, 0.095)
trim = part('trim', bm, dense=0.1, coarse=0.2)

# ---------------------------------------------------------------- dark rubber: skirt under the plinth, rings on the feet, the black floor of the platter well
bm = bmesh.new()
add_box(bm, (0, (Y0 + 0.11) / 2, 0), (4.92, 0.11 - Y0, 3.82), bevel=0.012, seg=2)
for fx, fz in [(-2.3, -1.8), (2.3, -1.8), (-2.3, 1.8), (2.3, 1.8)]:
    add_torus(bm, (fx, 0.0, fz), 0.25, 0.022, 'y', 40, 8)
add_cyl(bm, (CX, 0.43, CZ), WELL - 0.002, 0.02, 'y', segs=96)
dark = part('dark', bm)

# ---------------------------------------------------------------- felt slipmat: a rolled edge
bm = bmesh.new()
add_lathe(bm, [(0, 0.0), (1.482, 0.0), (1.5, 0.012), (1.5, 0.03), (1.488, 0.04), (1.35, 0.04), (0, 0.04)], (CX, 0.56, CZ), segs=128)
mat = part('mat', bm, loc=(CX, 0.56, CZ), dense=0.12, coarse=0.5)

# ---------------------------------------------------------------- platter: the metal body and the strobe band (local origin on the spindle, y = platter middle)
bm = bmesh.new()
add_lathe(bm, [(0, -0.06), (1.47, -0.06), (1.545, -0.052), (1.572, -0.034), (1.572, 0.048), (1.56, 0.06), (1.545, 0.06), (1.54, 0.052), (1.508, 0.052), (1.503, 0.06), (0, 0.06)], (0, 0, 0), segs=160)
platter_body = part('platter_body', bm, loc=(CX, PLAT_Y, CZ), local=True)
bm = bmesh.new()
fs = add_lathe(bm, [(1.58, -0.03), (1.58, 0.034)], (0, 0, 0), segs=180, uv=True)
orient_out(bm, fs, (0, 0, 0), 'y')
platter_strobe = part('platter_strobe', bm, loc=(CX, PLAT_Y, CZ), smooth_angle=3.0, local=True)

# ---------------------------------------------------------------- the pillar's dark cap
bm = bmesh.new()
add_cyl(bm, (PX, ARM_Y - 0.07, PZ), 0.19, 0.15, 'y', segs=48, bevel=0.025)
armcap = part('armcap', bm)

# ---------------------------------------------------------------- the arm (local frame: origin on the pivot, +x along the tube, y up)
bm = bmesh.new()
add_lathe(bm, [(0, 0.12), (0.052, 0.12), (0.05, 0.16), (0.044, 0.19), (0.04, 0.6), (0.036, 1.6), (0.033, 2.36), (0.04, 2.38), (0.04, 2.4), (0, 2.4)], (0, 0, 0), axis='x', segs=24)
add_lathe(bm, [(0.046, 0.46), (0.056, 0.47), (0.056, 0.52), (0.046, 0.53)], (0, 0, 0), axis='x', segs=24, closed=True)
add_lathe(bm, [(0, -0.2), (0.026, -0.2), (0.026, 0.125), (0, 0.125)], (0, 0, 0), axis='x', segs=12)               # the rod behind the pivot
add_lathe(bm, [(0, -0.09), (0.095, 0), (0.11, 0.0), (0, 0.09)], (0, 0, 0), axis='y', segs=40)                           # the gimbal: a lens of metal under the tube
# counterweight: rings cut into a cylinder, a flat end
cw = [(0, -0.52), (0.17, -0.52), (0.2, -0.49), (0.2, -0.43), (0.186, -0.425), (0.186, -0.405), (0.2, -0.4), (0.2, -0.3), (0.186, -0.295), (0.186, -0.275), (0.2, -0.27), (0.2, -0.22), (0.17, -0.19), (0, -0.19)]
add_lathe(bm, cw, (0, 0, 0), axis='x', segs=64)
# the finger lift: a wire out to the side and forward, ball end
for (a, b) in [((2.5, -0.03, 0.06), (2.5, -0.03, 0.27)), ((2.5, -0.03, 0.27), (2.68, -0.03, 0.27))]:
    ax = 'z' if a[2] != b[2] else 'x'
    ln = abs(b[2] - a[2]) if ax == 'z' else abs(b[0] - a[0])
    cm = ((a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2)
    add_lathe(bm, [(0, -ln / 2), (0.012, -ln / 2), (0.012, ln / 2), (0, ln / 2)], cm, axis=ax, segs=10)
add_lathe(bm, [(0, -0.02), (0.02, -0.01), (0.026, 0), (0.02, 0.01), (0, 0.02)], (2.7, -0.03, 0.27), axis='x', segs=12)
# stylus: cantilever and tip (the tip is at x = ARM_L, y = -0.25 where records.ts looks for it)
add_lathe(bm, [(0, -0.075), (0.012, -0.075), (0.006, 0.05), (0.002, 0.07), (0, 0.075)], (ARM_L - 0.02, -0.21, 0), axis='y', segs=8)
arm_metal = part('arm_metal', bm, loc=(PX, ARM_Y, PZ), smooth_angle=0.5, local=True)

bm = bmesh.new()
# headshell: a tapering plate with turned-up sides and a mounting collar
def taper(v):
    t = (v.co.x - (2.64 - 0.26)) / 0.52          # 0 at the arm, 1 at the cartridge: narrower toward the cartridge (Blender Y is site -z)
    v.co.y *= 1.0 - 0.28 * t
add_box(bm, (2.64, -0.02, 0), (0.52, 0.026, 0.15), bevel=0.006, seg=2, warp=taper)
for zs in (-1, 1):
    add_box(bm, (2.64, -0.005, zs * 0.0735), (0.5, 0.05, 0.014), bevel=0.005, seg=2)
add_lathe(bm, [(0.05, 2.36), (0.062, 2.37), (0.062, 2.42), (0.05, 2.43)], (0, -0.02, 0), axis='x', segs=24, closed=True)
arm_dark = part('arm_dark', bm, loc=(PX, ARM_Y, PZ), smooth_angle=0.5, local=True)

bm = bmesh.new()
add_box(bm, (2.8, -0.105, 0), (0.2, 0.1, 0.125), bevel=0.012, seg=3)
add_box(bm, (2.82, -0.045, 0), (0.17, 0.024, 0.11), bevel=0.005, seg=2)
for zs in (-1, 1):
    add_screw(bm, (2.76, -0.033, zs * 0.045), 0.012, 0.012, segs=10)
arm_cart = part('arm_cart', bm, loc=(PX, ARM_Y, PZ), smooth_angle=0.5, local=True)

# ---------------------------------------------------------------- AO: the body against itself, the arm against itself only
static = [plinth, plate, trim, dark, mat, platter_body, platter_strobe, armcap]
arm = [arm_metal, arm_dark, arm_cart]
bake_ao(static, dist=0.4, gamma=1.0, floor=0.1, hide=arm)
bake_ao(arm, dist=0.12, gamma=1.0, floor=0.25, hide=static)
export(OUT, static + arm, uv=True)
