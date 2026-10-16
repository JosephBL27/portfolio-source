# The hub TV (the orb set at the centre of the site): public/models/glb/hub-tv.glb. Radius-1 model space of createHubTV (src/v3/world/tvset.ts): +z out of the glass.
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/hub_tv.py -- public/models/glb/hub-tv.glb
# Only the STATIC hardware is modelled; the glass (CRT shader), the dial knob, the two push buttons, the tick marks, the LED lens, the grille dots and the
# chain links stay procedural in tvset.ts (they animate or are lit by the site). Parts: shell (gloss black, seam groove, AO), bezel (chrome ring + screws),
# gasket (black rubber lip), band (chrome seam band round the back), dialring + btnrings + ledring + grillering (machined surrounds), hardware (bosses, hex nuts,
# eyelets), ringtop (the swivel ring).
import bpy, bmesh, math, sys, os
sys.dont_write_bytecode = True   # Blender ignores PYTHONDONTWRITEBYTECODE; keeps __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

OUT = argv_out('public/models/glb/hub-tv.glb')
setup(64)
OPEN = math.radians(56)
LIP_Z, LIP_R = math.cos(OPEN), math.sin(OPEN)
VIS_R, VIS_Z = 0.768, 0.548
PIVOT_Y = 1.42


def arcpts(r0, z0, r1, z1, n, bulge=0.0):
    """points from (r0,z0) to (r1,z1), n steps, optionally bowed (a rounded chamfer)"""
    out = []
    for k in range(1, n + 1):
        t = k / n
        out.append((r0 + (r1 - r0) * t + bulge * math.sin(math.pi * t) * (z1 - z0), z0 + (z1 - z0) * t - bulge * math.sin(math.pi * t) * (r1 - r0)))
    return out


# ---------------------------------------------------------------- shell: the sphere from the lip round the back, with a seam groove at 100 degrees
prof = []
th = OPEN
while th < math.pi - 1e-6:
    step = 0.4 if th < math.radians(74) else 1.2
    deg = math.degrees(th)
    r = math.sin(th)
    z = math.cos(th)
    # seam groove (a sunk line with soft shoulders) and a second, hairline one at the lip
    for centre, w, d in ((100.0, 1.0, 0.0065), (66.0, 0.45, 0.003)):
        g = max(0.0, 1.0 - abs(deg - centre) / w)
        k = 1.0 - d * (g * g * (3 - 2 * g))
        r *= k
        z *= k
    prof.append((r, z))
    th += math.radians(step)
prof.append((0.0, -1.0))
bm = bmesh.new()
fs = add_lathe(bm, prof, (0, 0, 0), axis='z', segs=224)
orient_out(bm, fs, (0, 0, 0), 'z')
shell = part('shell', bm, smooth_angle=0.9)

# ---------------------------------------------------------------- bezel: chrome ring round the glass, with a stepped crown and sixteen screws
bz = [(VIS_R - 0.02, VIS_Z - 0.03), (VIS_R + 0.002, VIS_Z + 0.004), (VIS_R + 0.006, VIS_Z + 0.05), (VIS_R + 0.013, VIS_Z + 0.079), (VIS_R + 0.022, VIS_Z + 0.091), (VIS_R + 0.032, VIS_Z + 0.096),
      (LIP_R - 0.026, VIS_Z + 0.096), (LIP_R - 0.012, VIS_Z + 0.092), (LIP_R + 0.006, VIS_Z + 0.082), (LIP_R + 0.015, VIS_Z + 0.062), (LIP_R + 0.017, LIP_Z - 0.03), (LIP_R + 0.002, LIP_Z - 0.07)]
bm = bmesh.new()
fs = add_lathe(bm, bz, (0, 0, 0), axis='z', segs=224)
orient_out(bm, fs, (0, 0, 0), 'z')
for k in range(16):
    a = math.tau * (k + 0.5) / 16
    rr = (VIS_R + 0.032 + LIP_R - 0.026) / 2
    f0 = len(bm.verts)
    add_lathe(bm, [(0, 0), (0.0085, 0), (0.0085, 0.004), (0.0065, 0.0055), (0.0025, 0.0045), (0, 0.003)], (0, 0, 0), axis='z', segs=12)
    place_local(bm, f0, (math.cos(a) * rr, math.sin(a) * rr, VIS_Z + 0.096), (1, 0, 0), (0, 1, 0), (0, 0, 1))
bezel = part('bezel', bm, smooth_angle=0.5)

# ---------------------------------------------------------------- gasket: a flat black rubber lip pressed against the glass
bm = bmesh.new()
add_lathe(bm, [(VIS_R - 0.012, VIS_Z - 0.002), (VIS_R + 0.016, VIS_Z + 0.006), (VIS_R + 0.016, VIS_Z + 0.02), (VIS_R - 0.012, VIS_Z + 0.012)], (0, 0, 0), axis='z', segs=224, closed=True)
gasket = part('gasket', bm, smooth_angle=0.5)

# ---------------------------------------------------------------- band: a chrome seam round the back of the sphere (where the two shells meet)
bm = bmesh.new()
th0 = math.radians(100.0)
rb, zb = math.sin(th0) * 0.9935, math.cos(th0) * 0.9935
add_lathe(bm, [(rb - 0.004, zb - 0.016), (rb + 0.0035, zb - 0.0125), (rb + 0.0085, zb - 0.006), (rb + 0.0085, zb + 0.006), (rb + 0.0035, zb + 0.0125), (rb - 0.004, zb + 0.016)], (0, 0, 0), axis='z', segs=224, closed=True)
# twelve small bolt heads on the band
for k in range(12):
    a = math.tau * (k + 0.25) / 12
    f0 = len(bm.verts)
    add_lathe(bm, [(0, 0), (0.014, 0), (0.014, 0.006), (0.011, 0.0085), (0.004, 0.007), (0, 0.0055)], (0, 0, 0), axis='z', segs=6)
    x, y, z = frame_at((math.cos(a) * math.sin(th0), math.sin(a) * math.sin(th0), math.cos(th0)))
    place_local(bm, f0, (math.cos(a) * rb * 1.004, math.sin(a) * rb * 1.004, zb), x, y, z)
band = part('band', bm, smooth_angle=0.5)

# ---------------------------------------------------------------- the control side (frames as in createHubTV)
D1 = Vector((0.86, 0.36, 0.3)).normalized()
f1 = frame_at(D1)


def on_sphere(du, dv):
    return (D1 + f1[0] * du + f1[1] * dv).normalized()


def at_dir(bm, d, offset, prof, segs=64, axis_scale=1.0, **kw):
    x, y, z = frame_at(d)
    f0 = len(bm.verts)
    add_lathe(bm, prof, (0, 0, 0), axis='z', segs=segs, **kw)
    place_local(bm, f0, Vector(d).normalized() * offset, x, y, z)


bm = bmesh.new()
# dial: a machined surround with a stepped lip and four screws
at_dir(bm, D1, 0.986, [(0.198, -0.03), (0.198, 0.004), (0.208, 0.014), (0.222, 0.02), (0.236, 0.016), (0.242, 0.006), (0.242, -0.03)], 96, closed=True)
for k in range(4):
    a = math.tau * (k + 0.5) / 4
    x, y, z = frame_at(D1)
    f0 = len(bm.verts)
    add_lathe(bm, [(0, 0), (0.0075, 0), (0.0075, 0.003), (0.006, 0.0045), (0.002, 0.004), (0, 0.003)], (0, 0, 0), axis='z', segs=10)
    place_local(bm, f0, D1 * 0.986 + x * math.cos(a) * 0.22 + y * math.sin(a) * 0.22 + z * 0.0185, x, y, z)
for dv, du in ((-0.27, -0.07), (-0.27, 0.065)):
    at_dir(bm, on_sphere(du, dv), 0.992, [(0.052, -0.03), (0.052, 0.002), (0.062, 0.008), (0.072, 0.008), (0.076, 0.0), (0.076, -0.03)], 48, closed=True)
at_dir(bm, on_sphere(-0.005, -0.385), 1.0, [(0.018, -0.02), (0.018, 0.0), (0.024, 0.006), (0.032, 0.006), (0.036, 0.0), (0.036, -0.02)], 32, closed=True)
G = on_sphere(0.0, -0.7)
at_dir(bm, G, 0.998, [(0.262, -0.03), (0.262, 0.0), (0.272, 0.01), (0.282, 0.012), (0.292, 0.006), (0.296, -0.03)], 96, closed=True)
ctl = part('controls', bm, smooth_angle=0.5)

# ---------------------------------------------------------------- hardware: two bosses with hex nuts and eyelets, and the swivel ring on top
bm = bmesh.new()
for sx in (-1, 1):
    nrm = Vector((0.3 * sx, math.sqrt(1 - 0.09), 0)).normalized()
    x, y, z = frame_at(nrm)
    f0 = len(bm.verts)
    add_lathe(bm, [(0, -0.02), (0.056, -0.02), (0.056, 0.0), (0.05, 0.012), (0, 0.012)], (0, 0, 0), axis='z', segs=40)          # the boss disc
    add_lathe(bm, [(0, 0.012), (0.04, 0.012), (0.04, 0.034), (0.034, 0.038), (0, 0.038)], (0, 0, 0), axis='z', segs=6)           # hex nut
    place_local(bm, f0, nrm * 0.995, x, y, z)
    eye = nrm * 1.0 + Vector((0, 0.058, 0))
    add_torus(bm, (eye.x, eye.y, eye.z), 0.034, 0.0105, 'z', 36, 12)
    f0 = len(bm.verts)
    add_lathe(bm, [(0, -0.03), (0.011, -0.03), (0.011, 0.03), (0, 0.03)], (0, 0, 0), axis='y', segs=12)                              # the pin from nut to eyelet
    for v in list(bm.verts)[f0:]:
        v.co += S(nrm.x, nrm.y + 0.028, nrm.z + 0.0)
hardware = part('hardware', bm, smooth_angle=0.6)

bm = bmesh.new()
add_torus(bm, (0, PIVOT_Y, 0), 0.132, 0.024, 'z', 56, 16)
add_lathe(bm, [(0, -0.05), (0.03, -0.05), (0.036, -0.04), (0.036, 0.04), (0.03, 0.05), (0, 0.05)], (0, PIVOT_Y - 0.132, 0), axis='y', segs=24)   # the swivel's shoulder
ringtop = part('ringtop', bm, smooth_angle=0.6)

objs = [shell, bezel, gasket, band, ctl, hardware, ringtop]
bake_ao([shell], dist=0.2, gamma=1.0, floor=0.18, smooth=2)
bake_ao([o for o in objs if o is not shell], dist=0.08, gamma=1.0, floor=0.3, smooth=1)
export(OUT, objs)
