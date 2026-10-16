# The listening room's furniture (unit 15M): public/models/glb/room-hifi.glb (speaker, credenza, amplifier) and room-window.glb (a lancet window, tracery, sill, curtains).
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/room.py -- hifi public/models/glb/room-hifi.glb
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/room.py -- window public/models/glb/room-window.glb
# Site coordinates (lib.py): x right, y up, z toward the viewer. Every object stands on y = 0 about x = z = 0 with its FRONT toward +z; src/v3/world/extras/musicviz/room.ts
# places and clones them. The site assigns materials by part name (see room.ts). Moving parts keep their own origin: woofer / tweeter (the driver's centre).
import bpy, bmesh, math, sys, os
sys.dont_write_bytecode = True   # Blender ignores PYTHONDONTWRITEBYTECODE; keeps __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
WHAT = args[0] if args else 'hifi'
OUT = args[1] if len(args) > 1 else f'public/models/glb/room-{WHAT}.glb'
setup(48)

def cyl_z(bm, c, r, h, segs=48):
    return add_lathe(bm, [(0, -h / 2), (r, -h / 2), (r, h / 2), (0, h / 2)], c, axis='z', segs=segs)

if WHAT == 'hifi':
    # ------------------------------------------------------------ a floor-standing speaker: 1.2 wide, 2.9 tall, 1.0 deep (front +z)
    SW, SH, SD = 1.2, 2.9, 1.0
    bm = bmesh.new()
    add_box(bm, (0, SH / 2 + 0.08, 0), (SW, SH - 0.08, SD), bevel=0.06, seg=3)
    add_box(bm, (0, 0.05, 0), (SW - 0.16, 0.1, SD - 0.16), bevel=0.01, seg=2)        # a plinth under the cabinet
    speaker_body = part('speaker_body', bm, dense=0.16, uv=(2.0, 2.0))
    bm = bmesh.new()
    add_box(bm, (0, SH / 2 + 0.08, SD / 2 + 0.004), (SW - 0.16, SH - 0.26, 0.03), bevel=0.01, seg=2)   # the baffle: dark cloth
    speaker_baffle = part('speaker_baffle', bm, dense=0.2, uv=(1.0, 1.0))
    WC = (0, 1.05, SD / 2 + 0.03)
    bm = bmesh.new()      # woofer cone, dust cap and surround, centre WC (the site pumps it along z)
    add_lathe(bm, [(0, 0.115), (0.08, 0.105), (0.15, 0.06), (0.16, 0.02), (0.33, -0.04), (0.4, -0.07), (0.43, -0.065), (0.47, -0.04), (0.5, -0.045)], WC, axis='z', segs=64)
    woofer = part('woofer', bm, loc=WC, dense=0.1)
    TC = (0, 2.3, SD / 2 + 0.03)
    bm = bmesh.new()      # the tweeter dome
    add_lathe(bm, [(0, 0.055), (0.07, 0.045), (0.12, 0.02), (0.15, 0.0)], TC, axis='z', segs=40)
    tweeter = part('tweeter', bm, loc=TC)
    bm = bmesh.new()      # brass bezels, the port ring, the feet
    add_torus(bm, (WC[0], WC[1], WC[2] - 0.02), 0.545, 0.03, 'z', 64, 8)
    add_torus(bm, (TC[0], TC[1], TC[2] - 0.02), 0.2, 0.022, 'z', 48, 8)
    add_torus(bm, (0, 0.5, SD / 2 + 0.03), 0.13, 0.02, 'z', 36, 8)
    for fx in (-0.45, 0.45):
        for fz in (-0.3, 0.3):
            add_lathe(bm, [(0, 0.0), (0.06, 0.0), (0.05, 0.05), (0, 0.05)], (fx, 0, fz), segs=20)
    speaker_trim = part('speaker_trim', bm, dense=0.2, coarse=0.3)
    bm = bmesh.new()
    cyl_z(bm, (0, 0.5, SD / 2 + 0.02), 0.115, 0.02, 36)
    speaker_dark = part('speaker_dark', bm)
    static = [speaker_body, speaker_baffle, speaker_trim, speaker_dark]
    mov = [woofer, tweeter]

    # ------------------------------------------------------------ the credenza: slatted walnut sideboard, 3.4 wide, 0.95 tall, 0.85 deep
    CW, CH, CD = 3.4, 0.95, 0.85
    bm = bmesh.new()
    add_box(bm, (0, 0.6, 0), (CW - 0.08, 0.64, CD - 0.06), bevel=0.012, seg=2)
    add_box(bm, (0, 0.935, 0), (CW + 0.06, 0.08, CD + 0.06), bevel=0.02, seg=3)
    for lx in (-1.5, 1.5):
        for lz in (-0.3, 0.3):
            add_lathe(bm, [(0.05, 0.0), (0.04, 0.0), (0.05, 0.3), (0.065, 0.3)], (lx, 0, lz), segs=16, closed=True)
            add_lathe(bm, [(0, 0.0), (0.045, 0.0), (0.06, 0.28), (0, 0.3)], (lx, 0, lz), segs=16)
    credenza_body = part('credenza_body', bm, dense=0.2, uv=(2.0, 2.0))
    bm = bmesh.new()
    n = 22
    for i in range(n):
        x = -CW / 2 + 0.17 + i * (CW - 0.34) / (n - 1)
        add_box(bm, (x, 0.6, CD / 2 - 0.01), (0.1, 0.58, 0.05), bevel=0.012, seg=2)
    credenza_slats = part('credenza_slats', bm, uv=(1.0, 1.0))
    bm = bmesh.new()
    for hx in (-0.9, 0.9):
        add_cyl(bm, (hx, 0.6, CD / 2 + 0.05), 0.03, 0.06, 'z', segs=20)
        add_cyl(bm, (hx, 0.6, CD / 2 + 0.085), 0.045, 0.012, 'z', segs=24)
    for lx in (-1.5, 1.5):
        for lz in (-0.3, 0.3):
            add_cyl(bm, (lx, 0.012, lz), 0.07, 0.024, 'y', segs=20)
    credenza_trim = part('credenza_trim', bm)
    static += [credenza_body, credenza_slats, credenza_trim]

    # ------------------------------------------------------------ the amplifier: 2.5 wide, 0.54 tall, 0.7 deep; stands on y = 0 (the site sets it on the credenza)
    AW, AH, AD = 2.5, 0.54, 0.7
    bm = bmesh.new()
    add_box(bm, (0, AH / 2 + 0.03, 0), (AW - 0.04, AH - 0.02, AD), bevel=0.02, seg=2)
    for fx in (-1.05, 1.05):
        for fz in (-0.25, 0.25):
            add_lathe(bm, [(0, 0.0), (0.07, 0.0), (0.07, 0.03), (0, 0.03)], (fx, 0, fz), segs=20)
    for tx in (-0.6, -0.2, 0.2, 0.6):                                                  # tube sockets
        add_cyl(bm, (tx, AH + 0.06, -0.12), 0.1, 0.04, 'y', segs=24)
    amp_body = part('amp_body', bm, dense=0.2, uv=(1.5, 1.5))
    bm = bmesh.new()
    add_box(bm, (0, AH / 2 + 0.03, AD / 2 + 0.012), (AW, AH + 0.02, 0.03), bevel=0.012, seg=2)
    amp_face = part('amp_face', bm, dense=0.15, uv=(1.5, 1.5))
    bm = bmesh.new()
    for sx in (-1, 1):
        add_box(bm, (sx * (AW / 2 + 0.03), AH / 2 + 0.03, 0), (0.1, AH + 0.1, AD + 0.08), bevel=0.025, seg=3)
    amp_wood = part('amp_wood', bm, dense=0.15, uv=(1.5, 1.5))
    bm = bmesh.new()
    my = AH / 2 + 0.07
    for mx in (-0.62, 0.62):                                                           # meter bezels (rings) and the little lamp ring
        add_torus(bm, (mx, my, AD / 2 + 0.03), 0.285, 0.03, 'z', 56, 8)
    for kx in (-1.09, -0.19, 0.19, 1.09):                                              # knobs
        add_lathe(bm, [(0, 0.0), (0.075, 0.0), (0.08, 0.01), (0.07, 0.08), (0.06, 0.1), (0, 0.1)], (kx, my - 0.02, AD / 2 + 0.027), axis='z', segs=28)
    amp_trim = part('amp_trim', bm, dense=0.1, coarse=0.2)
    bm = bmesh.new()                                                                   # the tubes: glass envelopes (the site makes them glow)
    for tx in (-0.6, -0.2, 0.2, 0.6):
        add_lathe(bm, [(0, 0.0), (0.075, 0.0), (0.08, 0.02), (0.08, 0.2), (0.06, 0.27), (0.03, 0.3), (0, 0.31)], (tx, AH + 0.08, -0.12), segs=24)
    amp_tube = part('amp_tube', bm)
    static += [amp_body, amp_face, amp_wood, amp_trim, amp_tube]
    bake_ao(static, dist=0.35, gamma=1.0, floor=0.12, hide=mov)
    bake_ao(mov, dist=0.2, gamma=1.0, floor=0.3, hide=static)
    export(OUT, static + mov, uv=True)

else:
    # ------------------------------------------------------------ the lancet window: opening W wide, SPRING tall to the springing line, an equilateral pointed arch above it
    W, SPRING, T, DEP = 2.0, 1.7, 0.28, 0.3
    def arch(width, spring, n=14):
        """an open path from the bottom left, up, over the pointed arch, to the bottom right (x, y), y from the sill"""
        pts = [(-width / 2, 0.0), (-width / 2, spring)]
        for k in range(1, n + 1):      # left arc: centre (+w/2, spring), radius w, 180 deg -> 120 deg
            a = math.pi - (math.pi / 3) * k / n
            pts.append((width / 2 + width * math.cos(a), spring + width * math.sin(a)))
        for k in range(1, n):          # right arc: centre (-w/2, spring), 60 deg -> 0
            a = (math.pi / 3) * (1 - k / n)
            pts.append((-width / 2 + width * math.cos(a), spring + width * math.sin(a)))
        pts += [(width / 2, spring), (width / 2, 0.0)]
        return pts
    inner, outer = arch(W, SPRING), arch(W + 2 * T, SPRING)
    bm = bmesh.new()
    def V(p, z): return bm.verts.new(S(p[0], p[1], z))
    f_in = [V(p, 0.0) for p in inner]; f_out = [V(p, 0.0) for p in outer]
    b_in = [V(p, -DEP) for p in inner]; b_out = [V(p, -DEP) for p in outer]
    for i in range(len(inner) - 1):
        j = i + 1
        bm.faces.new((f_out[i], f_out[j], f_in[j], f_in[i]))        # the face
        bm.faces.new((f_in[i], f_in[j], b_in[j], b_in[i]))          # the reveal
        bm.faces.new((b_out[i], b_out[j], f_out[j], f_out[i]))      # the outer side
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    win_frame = part('win_frame', bm, dense=0.18, uv=(2.5, 2.5))
    bm = bmesh.new()        # mullions and tracery: a centre bar, a transom at the springing line, a ring in the head
    add_box(bm, (0, SPRING / 2 + 0.2, -0.1), (0.07, SPRING + 0.8, 0.09), bevel=0.012, seg=2)
    add_box(bm, (0, SPRING * 0.62, -0.1), (W, 0.07, 0.09), bevel=0.012, seg=2)
    add_box(bm, (0, SPRING, -0.1), (W, 0.07, 0.09), bevel=0.012, seg=2)
    add_torus(bm, (0, SPRING + 0.95, -0.1), 0.34, 0.035, 'z', 48, 8)
    add_torus(bm, (-0.5, SPRING + 0.35, -0.1), 0.16, 0.025, 'z', 32, 6)
    add_torus(bm, (0.5, SPRING + 0.35, -0.1), 0.16, 0.025, 'z', 32, 6)
    win_tracery = part('win_tracery', bm, dense=0.12, uv=(2.5, 2.5))
    bm = bmesh.new()
    add_box(bm, (0, -0.05, 0.12), (W + 2 * T + 0.5, 0.14, 0.6), bevel=0.03, seg=3)
    win_sill = part('win_sill', bm, dense=0.2, uv=(2.5, 2.5))
    # curtains: a hanging panel with soft folds, wider folds toward the floor; rod, rings, finials in brass
    CWID, CHEI, FOLDS = 0.95, 4.8, 3.5
    def curtain(name, cx, side):
        bm = bmesh.new()
        NX, NY = 26, 36
        grid = []
        for iy in range(NY + 1):
            v = iy / NY
            row = []
            for ix in range(NX + 1):
                u = ix / NX
                amp = 0.035 + 0.1 * v
                z = 0.2 + amp * math.sin(u * math.tau * FOLDS + v * 1.6 + side) 
                x = cx + (u - 0.5) * CWID * (1.0 - 0.1 * math.sin(v * math.pi))
                x += side * 0.14 * (1 - v) * 0                       # (a tie-back could pull the middle in)
                y = 4.2 - v * CHEI
                row.append(bm.verts.new(S(x, y, z)))
            grid.append(row)
        for iy in range(NY):
            for ix in range(NX):
                bm.faces.new((grid[iy][ix], grid[iy][ix + 1], grid[iy + 1][ix + 1], grid[iy + 1][ix]))
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        return part(name, bm, smooth_angle=3.0, uv=(CWID * 2, CHEI))
    cx = W / 2 + T + 0.48
    curtain_l = curtain('curtain_l', -cx, -1)
    curtain_r = curtain('curtain_r', cx, 1)
    bm = bmesh.new()
    ROD_Y, ROD_Z = 4.25, 0.24
    add_lathe(bm, [(0, -cx - 0.9), (0.03, -cx - 0.9), (0.03, cx + 0.9), (0, cx + 0.9)], (0, ROD_Y, ROD_Z), axis='x', segs=20)
    for sx in (-1, 1):
        add_lathe(bm, [(0, 0.0), (0.06, 0.0), (0.09, 0.05), (0.09, 0.09), (0.05, 0.13), (0, 0.15)], (sx * (cx + 0.9), ROD_Y, ROD_Z), axis='x', segs=24, rot=0)
    for sx in (-1, 1):
        for k in range(9):
            add_torus(bm, (sx * (cx + (k - 4) * CWID / 8.5), ROD_Y, ROD_Z), 0.045, 0.01, 'x', 20, 6)
    win_brass = part('win_brass', bm, dense=0.2, coarse=0.4)
    stone = [win_frame, win_tracery, win_sill, win_brass]
    bake_ao(stone, dist=0.3, gamma=1.0, floor=0.2, hide=[curtain_l, curtain_r])
    bake_ao([curtain_l, curtain_r], dist=0.25, gamma=1.0, floor=0.5, hide=stone)
    export(OUT, stone + [curtain_l, curtain_r], uv=True)
