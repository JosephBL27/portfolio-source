# Unit 15B props for the three games stops: public/models/glb/games-props.glb  (one process, Draco, AO baked into COLOR_0, no materials; the site assigns PBR by part name)
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/games/props.py -- public/models/glb/games-props.glb
# Every prop is built about its own origin (floor centre, facing +z) so the site places it with one position + yaw. All generic: no brand, no print.
# Parts: boxstack, boxlid (a pile of lidded game boxes), cardfan, chair, chairwood, cushion, stone, firebox, logs, rope, book0..book3, pages
import bpy, bmesh, math, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from lib import *
from mathutils import Matrix

OUT = argv_out('public/models/glb/games-props.glb')
setup(24)


def new_since(bm, before):
    return [v for v in bm.verts if v not in before]


def spin(bm, verts, pivot, ang, axis='Z'):
    bmesh.ops.rotate(bm, cent=S(*pivot), matrix=Matrix.Rotation(ang, 3, axis), verts=verts)


def tube(bm, pts, r, segs=8):
    """a round tube along a polyline of site points"""
    rings = []
    n = len(pts)
    for i, p in enumerate(pts):
        a = Vector(pts[max(i - 1, 0)]); b = Vector(pts[min(i + 1, n - 1)])
        t = (b - a)
        if t.length < 1e-6:
            t = Vector((1, 0, 0))
        t.normalize()
        up = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
        u = t.cross(up).normalized(); w = t.cross(u).normalized()
        row = []
        for k in range(segs):
            ang = TAU * k / segs
            q = Vector(p) + u * (math.cos(ang) * r) + w * (math.sin(ang) * r)
            row.append(bm.verts.new(S(q.x, q.y, q.z)))
        rings.append(row)
    for i in range(n - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
    for ring in (rings[0], rings[-1]):
        bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))


objs = []

# ---- a pile of lidded game boxes on the floor (the four sit squarely, slightly yawed)
bm = bmesh.new(); bm2 = bmesh.new()
stack = [((0.0, 0.0), 1.55, 0.34, 1.1, 0.12), ((0.06, 0.02), 1.3, 0.26, 0.95, -0.2), ((-0.04, -0.02), 1.12, 0.3, 0.85, 0.3), ((0.03, 0.03), 0.9, 0.2, 0.7, -0.1)]
y = 0.0
for (cx, cz), w, h, d, yaw in stack:
    before = set(bm.verts)
    add_box(bm, (cx, y + (h - 0.03) / 2, cz), (w, h - 0.03, d), bevel=0.02, seg=2)
    spin(bm, new_since(bm, before), (cx, y, cz), yaw)
    before = set(bm2.verts)
    add_box(bm2, (cx, y + h - 0.03 + 0.03, cz), (w + 0.05, 0.07, d + 0.05), bevel=0.02, seg=2)
    spin(bm2, new_since(bm2, before), (cx, y, cz), yaw)
    y += h + 0.04
objs.append(part('boxstack', bm, smooth_angle=0.5, dense=0.0)); objs.append(part('boxlid', bm2, smooth_angle=0.5))

# ---- a fan of seven playing cards lying on the rug (the corner of each overlaps the last)
bm = bmesh.new()
for i in range(7):
    before = set(bm.verts)
    add_box(bm, (0.0, 0.008 + i * 0.011, 0.45), (0.62, 0.008, 0.9), bevel=0.0)
    spin(bm, new_since(bm, before), (0, 0, 0), (i - 3) * 0.19)
objs.append(part('cardfan', bm, smooth_angle=0.9))

# ---- a leather armchair, facing +z (floor centre origin): a wide seat, a high back, rolled arms, an loose cushion and four short legs
bm = bmesh.new()
add_box(bm, (0, 0.62, 0.0), (2.0, 0.5, 1.9), bevel=0.14, seg=4)                       # seat base
add_box(bm, (0, 1.55, -0.8), (2.2, 1.9, 0.5), bevel=0.2, seg=4)                       # the back
for sx in (-1, 1):
    add_box(bm, (sx * 1.1, 1.05, 0.02), (0.32, 0.8, 1.95), bevel=0.14, seg=4)          # the arms
chair = part('chair', bm, smooth_angle=0.9, dense=0.0)
bm = bmesh.new()
add_box(bm, (0, 0.97, 0.12), (1.62, 0.26, 1.46), bevel=0.1, seg=4)
cush = part('cushion', bm, smooth_angle=0.9)
bm = bmesh.new()
for sx in (-1, 1):
    for sz in (-1, 1):
        add_cyl(bm, (sx * 0.86, 0.17, sz * 0.78), 0.07, 0.34, segs=14, bevel=0.015)
wood = part('chairwood', bm, smooth_angle=0.6)
objs += [chair, cush, wood]

# ---- a stone fireplace, back to -z: jambs, lintel, mantel, hearth. Opening 2.5 wide, 2.0 tall. Origin: floor centre of the opening
bm = bmesh.new()
OW, OH = 2.5, 2.0
for sx in (-1, 1):
    add_box(bm, (sx * (OW / 2 + 0.55), 1.7, 0.0), (1.1, 3.4, 0.9), bevel=0.04, seg=2)
add_box(bm, (0, OH + 0.35, 0.0), (OW + 2.2, 0.7, 0.9), bevel=0.04, seg=2)
add_box(bm, (0, OH + 0.82, 0.12), (OW + 3.0, 0.2, 1.2), bevel=0.05, seg=3)                # the mantel shelf
add_box(bm, (0, 3.2, -0.08), (OW + 2.2, 1.2, 0.7), bevel=0.04, seg=2)                      # chimney breast
add_box(bm, (0, 0.04, 0.85), (OW + 2.6, 0.14, 1.3), bevel=0.03, seg=2)                     # the hearth
stone = part('stone', bm, smooth_angle=0.5)
bm = bmesh.new()
add_box(bm, (0, OH / 2, -0.38), (OW, OH, 0.12))                                              # back wall of the firebox
add_box(bm, (0, 0.06, -0.05), (OW, 0.1, 0.7))                                                # its floor
for sx in (-1, 1):
    add_box(bm, (sx * (OW / 2 - 0.06), OH / 2, -0.05), (0.12, OH, 0.7))                      # sides
firebox = part('firebox', bm, smooth_angle=0.5)
bm = bmesh.new()
for i, (ang, off) in enumerate([(0.15, 0.0), (-0.3, 0.1), (1.4, -0.1)]):
    before = set(bm.verts)
    add_cyl(bm, (off, 0.25 + 0.14 * (i == 2), -0.05), 0.11, 1.5, axis='x', segs=12)
    spin(bm, new_since(bm, before), (off, 0.25, -0.05), ang, 'Z')
logs = part('logs', bm, smooth_angle=0.7)
objs += [stone, firebox, logs]

# ---- a coil of climbing rope with a tail; origin: centre of the coil on the floor
bm = bmesh.new()
pts = []
turns, n = 4.5, 360
for i in range(n + 1):
    t = i / n
    a = TAU * turns * t
    rad = 0.62 - 0.08 * t
    pts.append((math.cos(a) * rad, 0.06 + 0.075 * (t * turns) % 1 + 0.0 * t, math.sin(a) * rad * 0.94))
# stack the turns: raise each full turn by one rope thickness
pts = [(p[0], 0.06 + 0.11 * math.floor(turns * i / n) / 1.0 * 0.0 + 0.11 * (turns * i / n) , p[2]) for i, p in enumerate(pts)]
pts = [(p[0], min(p[1], 0.06 + 0.16 * 2), p[2]) for p in pts]
# the tail leaves the coil and snakes across the floor toward +z
x0, z0 = pts[-1][0], pts[-1][2]
for i in range(1, 90):
    t = i / 89
    pts.append((x0 + t * 1.6 + 0.35 * math.sin(t * 7.0), 0.055, z0 + t * 2.4 + 0.3 * math.sin(t * 5.0 + 1.0)))
tube(bm, pts, 0.05, segs=8)
rope = part('rope', bm, smooth_angle=0.9)
objs.append(rope)

# ---- four books leaning in a stack + one block of pages (cream) shared
bm_p = bmesh.new()
books = []
y = 0.0
for i, (w, h, d, yaw) in enumerate([(1.0, 0.16, 0.72, 0.1), (0.9, 0.12, 0.64, -0.22), (0.8, 0.14, 0.58, 0.28), (0.66, 0.1, 0.5, -0.1)]):
    bm = bmesh.new()
    before = set(bm.verts)
    add_box(bm, (0, y + h / 2, 0), (w, h, d), bevel=0.012, seg=2)
    spin(bm, new_since(bm, before), (0, y, 0), yaw)
    books.append(part('book%d' % i, bm, smooth_angle=0.6))
    before = set(bm_p.verts)
    add_box(bm_p, (0.025, y + h / 2, 0.012), (w - 0.06, h - 0.045, d - 0.02))
    spin(bm_p, new_since(bm_p, before), (0, y, 0), yaw)
    y += h
objs += books
objs.append(part('pages', bm_p, smooth_angle=0.5))

bake_ao([o for o in objs if o.name not in ('rope', 'cardfan')], dist=0.35, floor=0.45, smooth=1)
bake_ao([o for o in objs if o.name in ('rope', 'cardfan')], dist=0.2, floor=0.5, smooth=1)
export(OUT, objs, uv=False)
