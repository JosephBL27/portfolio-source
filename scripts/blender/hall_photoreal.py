# The gothic hall, photoreal (wave 22, unit r3-hall): a Blender build that assembles the hall's architecture, furniture and Poly Haven props (all CC0), lights it with
# the five stained-glass windows as real light sources (a sun through the coloured glass, plus glass emission) and warm candles, bakes the global illumination
# into one 2048 lightmap in Cycles (Metal) and exports ONE Draco + WebP GLB the site loads lazily at the gate approach.
#
# Round 4 changes (unit r3-hall): the warm fills are 15 W (were 160), the door spill 90 W; each window gets a coloured soft point 1.3 m in front of it ('halo', the glass is coplanar
# with the wall so its own emission cannot light the wall it sits in) and another 3.4 m out ('wash', so the glow reaches the wall under the sills, the dais and the ribs);
# the vault is the ashlar limestone (the white plaster read as mottled marble); the lightmap is edge-aware denoised (Cycles' bake has none); two Poly Haven statues flank the
# far doors and a marble bust stands on a plinth in every bay; the woods and every prop texture are shrunk (packed) to 512 so the GPU texture total is about 50 MB;
# the export keeps the props' linear light ('hp_lin'), so `--stages export --exposure E` re-exposes in seconds without a bake. Exposure is a fixed number now (default
# median-lit-texel normalisation only with --lmmed): the shipped exposure is 1.3. The vault darkens in the runtime shader (hall/photoreal.ts HP_VAULT), not here.
#
# Runtime contract (src/v3/world/extras/hall/photoreal.ts): every mesh primitive keeps its material name (hp_*). TEXCOORD_0 = the tile / prop albedo UV, TEXCOORD_1 = the
# lightmap UV (carried through the exporter by a dummy occlusion texture). The site shows albedo x lightmap in an unlit MeshBasicMaterial; hp_flame is a plain bright colour.
# Everything is authored in HALL-LOCAL coordinates (x across, +x on the left when facing the windows; y up; z = depth into the hall, the door at z = 0 and the end wall
# at z = 36), through S(), so the GLB drops straight under the hall rig's root group. No source texture is stored in the repo: out/assets-src/<slug>/ holds the CC0 downloads.
#
# Run, headless:   Blender -b --factory-startup -P scripts/blender/hall_photoreal.py -- --root <repo> [--stages build,unwrap,bake,export] [--spp 192] [--res 2048]
# Run, in a live Blender over the MCP (build, unwrap, bake, export take about 40 s at 384 spp, 60 s at 640):  exec(compile(open(P).read(), P, 'exec'), {'HALL_ARGS': {'root': R, 'stages': ['build', 'unwrap', 'bake', 'export'], 'spp': 640}, 'bpy': bpy, '__name__': 'hall_photoreal_exec'})
# It builds in its own scene "hall_photoreal" (the open session's scene is left alone) and prefixes every datablock it makes with hp_.
import bpy, bmesh, math, os, sys, json, time, random, struct
from mathutils import Vector, Matrix, Euler
from mathutils import geometry as mg


def _args():
    a = dict(globals().get('HALL_ARGS') or {})
    if '--' in sys.argv:
        rest = sys.argv[sys.argv.index('--') + 1:]
        i = 0
        while i < len(rest):
            if rest[i].startswith('--'):
                k = rest[i][2:]
                if i + 1 < len(rest) and not rest[i + 1].startswith('--'):
                    a[k] = rest[i + 1]; i += 2
                else:
                    a[k] = True; i += 1
            else:
                i += 1
    return a


A = _args()
ROOT = A.get('root') or os.getcwd()
SRC = A.get('src') or ROOT + '/out/assets-src'
OUT = A.get('out') or ROOT + '/out/hall-build'
STAGES = A.get('stages') or ['build', 'unwrap', 'bake', 'export']
if isinstance(STAGES, str):
    STAGES = STAGES.split(',')
SPP = int(A.get('spp') or 192)
RES = int(A.get('res') or 2048)
PREFIX = 'hp_'
os.makedirs(OUT, exist_ok=True)
T0 = time.time()


def log(*a):
    print('[hall %5.1fs]' % (time.time() - T0), *a, flush=True)


# ------------------------------------------------------------------------------------------------ the hall's numbers (extras/hall/shell.ts, material.ts, layout.ts)
HALL_LEN, PITCH = 36.0, 3.1
HW = 9.0
WALL = 0.9
SPRING = 8.8
RV = HW * 1.12
BAYS = 6
BAY = HALL_LEN / BAYS
APEX = SPRING + math.sqrt(RV * RV - (RV - HW) ** 2)
WIN = dict(w=2.5, h=9.2, sill=6.0)
DOOR = dict(hw=1.6, h=5.4, base=0.22)
L = HALL_LEN
SIDE_PANE = dict(hw=1.05, h=5.9, y0=2.7, recess=0.25)
SUN_TO = (0.1, 0.55, 0.83)           # direction from a floor point TOWARD the sun: the analytic sun patches in hall/material.ts use the same slope
win_x = lambda i: (2 - i) * PITCH
LIGHT = [(0.32, 0.62, 1.0), (0.3, 0.95, 0.5), (1.0, 0.3, 0.68), (1.0, 0.7, 0.24), (0.66, 0.46, 1.0)]   # hall/glass.ts interestsFrom(): the colour of each window's light


def S(x, y, z):
    """hall-local (x across, y up, z depth) -> Blender (X, Y, Z up)"""
    return Vector((x, -z, y))


def lerp(a, b, t):
    return a + (b - a) * t


# ------------------------------------------------------------------------------------------------ geometry primitives (into one bmesh per material)
class B:
    bms = {}

    @classmethod
    def get(cls, m):
        if m not in cls.bms:
            bm = bmesh.new()
            bm.loops.layers.uv.new('uv0')
            bm.faces.layers.int.new('custom')
            cls.bms[m] = bm
        return cls.bms[m]

    @classmethod
    def reset(cls):
        for b in cls.bms.values():
            b.free()
        cls.bms = {}


def _xf(bm, verts, c, size=(1, 1, 1), ry=0.0, rot=None):
    M = Matrix.Translation(S(*c)) @ Matrix.Rotation(ry, 4, 'Z') @ (rot if rot is not None else Matrix.Identity(4)) @ Matrix.Diagonal((size[0], size[2], size[1], 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=verts)


def _edges(verts):
    return list({e for v in verts for e in v.link_edges})


def box(m, c, size, ry=0.0, bevel=0.0, seg=1):
    """a box centred at c (hall-local), size (sx, sy, sz), turned ry about the hall's vertical"""
    bm = B.get(m)
    verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
    _xf(bm, verts, c, size, ry)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=_edges(verts), offset=bevel, segments=seg, affect='EDGES')
    return verts


def cyl(m, c, r_bot, r_top, h, axis='y', segs=16, ry=0.0):
    bm = B.get(m)
    verts = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r_bot, radius2=r_top, depth=h)['verts']
    rot = None
    if axis == 'z':
        rot = Matrix.Rotation(math.pi / 2, 4, 'X')
    elif axis == 'x':
        rot = Matrix.Rotation(math.pi / 2, 4, 'Y')
    _xf(bm, verts, c, (1, 1, 1), ry, rot)
    return verts


def sphere(m, c, r, segs=12, rings=8, scale=(1, 1, 1)):
    bm = B.get(m)
    verts = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)['verts']
    _xf(bm, verts, c, scale)
    return verts


def lathe(m, prof, c, segs=16, tile=2.0):
    """revolve [(r, h), ...] about the vertical through c; a point with r < 0.002 closes on the axis. UVs: u round the circumference, v up the profile (custom, no seam)"""
    bm = B.get(m)
    uvl = bm.loops.layers.uv['uv0']
    cl = bm.faces.layers.int['custom']
    rings = []
    for (r, h) in prof:
        if r < 0.002:
            rings.append([bm.verts.new(S(c[0], c[1] + h, c[2]))])
        else:
            rings.append([bm.verts.new(S(c[0] + r * math.cos(math.tau * j / segs), c[1] + h, c[2] + r * math.sin(math.tau * j / segs))) for j in range(segs)])
    faces = []
    for i in range(len(prof) - 1):
        A_, B_ = rings[i], rings[i + 1]
        for j in range(segs):
            j2 = (j + 1) % segs
            try:
                if len(A_) == 1 and len(B_) == 1:
                    continue
                if len(A_) == 1:
                    f = bm.faces.new((A_[0], B_[j2], B_[j]))
                    pts = [(0, i), (j2, i + 1), (j, i + 1)]
                elif len(B_) == 1:
                    f = bm.faces.new((A_[j], A_[j2], B_[0]))
                    pts = [(j, i), (j2, i), (0, i + 1)]
                else:
                    f = bm.faces.new((A_[j], A_[j2], B_[j2], B_[j]))
                    pts = [(j, i), (j2, i), (j2, i + 1), (j, i + 1)]
                f[cl] = 1
                for l, (jj, ii) in zip(f.loops, pts):
                    r = max(prof[ii][0], 0.05)
                    jx = jj if jj != 0 or j != segs - 1 else segs
                    l[uvl].uv = (math.tau * r * (jx / segs) / tile, prof[ii][1] / tile)
                faces.append(f)
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def extrude_poly(m, loops, depth, place):
    """a closed solid: the polygon `loops` (first = outline, the rest = holes; 2D points) extruded `depth`. place(u, v, t) -> Blender-space Vector for the point (u, v) at extrusion distance t"""
    bm = B.get(m)
    tris = mg.tessellate_polygon([[Vector((x, y, 0.0)) for (x, y) in lp] for lp in loops])
    vf, vb, spans, o = [], [], [], 0
    for lp in loops:
        for (x, y) in lp:
            vf.append(bm.verts.new(place(x, y, 0.0)))
            vb.append(bm.verts.new(place(x, y, depth)))
        spans.append((o, len(lp)))
        o += len(lp)
    faces = []
    for t in tris:
        try:
            faces.append(bm.faces.new((vf[t[0]], vf[t[1]], vf[t[2]])))
            faces.append(bm.faces.new((vb[t[2]], vb[t[1]], vb[t[0]])))
        except ValueError:
            pass
    for (o, n) in spans:
        for i in range(n):
            j = (i + 1) % n
            try:
                faces.append(bm.faces.new((vf[o + i], vf[o + j], vb[o + j], vb[o + i])))
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def tube(m, pts, r, sides=6, cap=True):
    """a round bar swept along a polyline of hall-local points"""
    bm = B.get(m)
    P = [S(*p) for p in pts]
    rings = []
    up = Vector((0, 0, 1))
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        n = t.cross(up)
        if n.length < 1e-4:
            n = t.cross(Vector((1, 0, 0)))
        n.normalize()
        b = t.cross(n).normalized()
        rings.append([bm.verts.new(p + (n * math.cos(math.tau * k / sides) + b * math.sin(math.tau * k / sides)) * r) for k in range(sides)])
    faces = []
    for i in range(len(rings) - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            try:
                faces.append(bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k])))
            except ValueError:
                pass
    if cap:
        for ring in (rings[0], rings[-1]):
            try:
                faces.append(bm.faces.new(ring))
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return faces


def arch_pts(hw, ys, R, off=0.0, n=14):
    """extras/transitions/common.ts pointedArch: left foot -> apex -> right foot, as (x, y)"""
    cx = -hw + R
    r = R + off
    aend = math.acos(-cx / r)
    left = [(cx + r * math.cos(lerp(math.pi, aend, i / n)), ys + r * math.sin(lerp(math.pi, aend, i / n))) for i in range(n + 1)]
    right = [(-x, y) for (x, y) in reversed(left[:-1])]
    return left + right


def lancet_rise(hw):
    R = hw * 1.9
    return math.sqrt(R * R - (R - hw) ** 2)


def lancet(hw, h, grow=0.0, n=14):
    """shell.ts lancetPts: left foot, spring, arch, right foot; origin at the foot centre"""
    R = hw * 1.9
    arch = arch_pts(hw + grow, h - lancet_rise(hw), R, 0.0, n)
    return [(-hw - grow, -grow)] + arch + [(hw + grow, -grow)]


def shift(pts, dx, dy):
    return [(x + dx, y + dy) for (x, y) in pts]


def archy(x, off=0.0):
    """height of the vault's inner surface at lateral x"""
    return SPRING + math.sqrt(max(0.0, (RV + off) ** 2 - (-abs(x) - (-HW + RV)) ** 2))


def band(off_out, off_in, n=22):
    o = arch_pts(HW, SPRING, RV, off_out, n)
    i = arch_pts(HW, SPRING, RV, off_in, n)[::-1]
    return o + i


def assign_uv0(bm, tile):
    """box projection by the dominant axis of the face normal (hall-local), tile = metres per texture repeat; faces with custom UVs (lathes) are skipped"""
    bm.normal_update()
    uvl = bm.loops.layers.uv['uv0']
    cl = bm.faces.layers.int['custom']
    for f in bm.faces:
        if f[cl]:
            continue
        n = f.normal
        hx, hy, hz = abs(n.x), abs(n.z), abs(n.y)
        for l in f.loops:
            x, y, z = l.vert.co.x, l.vert.co.z, -l.vert.co.y
            if hx >= hy and hx >= hz:
                u, v = z, y
            elif hy >= hz:
                u, v = x, z
            else:
                u, v = x, y
            l[uvl].uv = (u / tile, v / tile)


# ------------------------------------------------------------------------------------------------ materials
TILE = {   # name: (texture slug, metres per repeat, tint) ; the tint multiplies the albedo in the site's material (kept 1 here: the photograph's own colour)
    'hp_stone': ('medieval_blocks_03', 2.0),
    'hp_dressed': ('sandstone_blocks_08', 3.0),
    'hp_floor': ('large_floor_tiles_02', 3.0),
    'hp_wood': ('dark_wood', 2.0),
    'hp_panel': ('dark_paneled_wood', 1.4),
    'hp_plaster': ('sandstone_blocks_08', 4.0),   # the vault webbing: ashlar limestone (the white plaster read as mottled marble), the same image as the dressed stone so it costs no extra texture
}
TILE_PX = {'hp_wood': 512, 'hp_panel': 512}   # GPU texture budget (DESIGN.md: 64 MB for the hall): the vault and the woods are seen small
FLAT = {   # name: base colour (linear) for cloth, iron, brass
    'hp_cloth': (0.085, 0.006, 0.014),
    'hp_iron': (0.035, 0.035, 0.04),
    'hp_brass': (0.34, 0.2, 0.06),
    'hp_door': (0.05, 0.03, 0.02),
}


def shrink(img, px, name):
    """a copy of img at px x px (or the image itself when it is already that small), packed so the glTF exporter writes THIS size, not the file on disk"""
    if img.size[0] <= px:
        return img
    im2 = img.copy()
    im2.name = name
    im2.scale(px, px)
    im2.pack()
    return im2


def new_mat(name):
    mat = bpy.data.materials.get(name)
    if mat:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.85
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return mat, nt, bsdf


def occlusion_hook(nt, dummy):
    """the glTF exporter only writes TEXCOORD_1 for a UV map a material uses: a 4x4 occlusion texture on the 'lm' UV map carries the lightmap's UVs through"""
    g = bpy.data.node_groups.get('glTF Material Output')
    if g is None:
        g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    gn = nt.nodes.new('ShaderNodeGroup')
    gn.node_tree = g
    t2 = nt.nodes.new('ShaderNodeTexImage')
    t2.image = dummy
    u2 = nt.nodes.new('ShaderNodeUVMap')
    u2.uv_map = 'lm'
    nt.links.new(u2.outputs[0], t2.inputs[0])
    nt.links.new(t2.outputs[0], gn.inputs['Occlusion'])


def make_materials():
    dummy = bpy.data.images.get('hp_dummy_ao')
    if dummy:
        bpy.data.images.remove(dummy)
    dummy = bpy.data.images.new('hp_dummy_ao', 4, 4)
    dummy.colorspace_settings.name = 'Non-Color'
    dummy.pixels = [1.0] * 64
    mats = {}
    for name, (slug, tile) in TILE.items():
        mat, nt, bsdf = new_mat(name)
        path = '%s/%s/%s_diff_1k.jpg' % (SRC, slug, slug)
        img = bpy.data.images.get(slug + '_diff_1k.jpg')
        if img is None:
            img = bpy.data.images.load(path)
        img.colorspace_settings.name = 'sRGB'
        img = shrink(img, TILE_PX.get(name, 1024), 'hp_tile_' + slug)
        img.colorspace_settings.name = 'sRGB'
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        uvn = nt.nodes.new('ShaderNodeUVMap')
        uvn.uv_map = 'uv0'
        nt.links.new(uvn.outputs[0], tex.inputs[0])
        nt.links.new(tex.outputs[0], bsdf.inputs['Base Color'])
        occlusion_hook(nt, dummy)
        mat['tile'] = tile
        mat['slug'] = slug
        mats[name] = mat
    for name, col in FLAT.items():
        mat, nt, bsdf = new_mat(name)
        bsdf.inputs['Base Color'].default_value = (*col, 1.0)
        occlusion_hook(nt, dummy)
        mats[name] = mat
    mat, nt, bsdf = new_mat('hp_flame')
    bsdf.inputs['Base Color'].default_value = (0, 0, 0, 1)
    bsdf.inputs['Emission Color'].default_value = (1.0, 0.62, 0.2, 1.0)
    bsdf.inputs['Emission Strength'].default_value = 8.0
    mats['hp_flame'] = mat
    return mats


# ------------------------------------------------------------------------------------------------ the architecture
def build_architecture():
    zs = [j * BAY for j in range(BAYS + 1)]
    # ---- floor, runner
    for k in range(12):
        box('hp_floor', (0, -0.15, 1.5 + 3.0 * k - 0.1 + (0.2 if k == 11 else 0.0)), (2 * (HW + WALL), 0.3, 3.0 + (0.4 if k == 11 else 0.0)))
    box('hp_cloth', (0, 0.007, L / 2 - 0.2), (1.9, 0.014, L - 2.4))
    # ---- the vault: the pointed barrel as a closed band (its inner face is the ceiling)
    for j in range(BAYS):
        extrude_poly('hp_plaster', [band(WALL, 0.0)], BAY, lambda u, v, t, j=j: S(u, v, j * BAY + t))
    # ---- side walls: a skin 0.25 thick with a recess for each ornamental lancet, and the core behind it
    for sg in (-1, 1):
        box('hp_stone', (sg * (HW + 0.25 + (WALL - 0.25) / 2), (SPRING + 0.2) / 2, L / 2), (WALL - 0.25, SPRING + 0.2, L))
        for j in range(BAYS):
            outline = [(zs[j], 0.0), (zs[j + 1], 0.0), (zs[j + 1], SPRING + 0.2), (zs[j], SPRING + 0.2)]
            hole = shift(lancet(SIDE_PANE['hw'], SIDE_PANE['h']), (zs[j] + zs[j + 1]) / 2, SIDE_PANE['y0'])
            extrude_poly('hp_stone', [outline, hole], SIDE_PANE['recess'], lambda u, v, t, sg=sg: S(sg * (HW + t), v, u))
        # a stone frame round each lancet, standing proud of the wall
        for j in range(BAYS):
            zc = (zs[j] + zs[j + 1]) / 2
            outer = shift(lancet(SIDE_PANE['hw'], SIDE_PANE['h'], 0.2), zc, SIDE_PANE['y0'])
            inner = shift(lancet(SIDE_PANE['hw'], SIDE_PANE['h'], 0.0), zc, SIDE_PANE['y0'])
            extrude_poly('hp_dressed', [outer, inner], 0.2, lambda u, v, t, sg=sg: S(sg * (HW - t), v, u))
            box('hp_dressed', (sg * (HW - 0.17), SIDE_PANE['y0'] - 0.07, zc), (0.34, 0.14, 2 * SIDE_PANE['hw'] + 0.7))
    # ---- oak wainscot, its cap rail, a string course
    for sg in (-1, 1):
        box('hp_panel', (sg * (HW - 0.07), 1.15, L / 2), (0.14, 2.3, L - 0.4), bevel=0.01)
        box('hp_wood', (sg * (HW - 0.13), 2.36, L / 2), (0.26, 0.12, L - 0.4), bevel=0.02, seg=2)
        box('hp_dressed', (sg * (HW - 0.1), 8.0, L / 2), (0.2, 0.14, L), bevel=0.02)
    # ---- the end wall: five lancet windows and the far doors cut through it
    ys = WIN['sill'] + WIN['h'] - lancet_rise(WIN['w'] / 2)
    hw = WIN['w'] / 2
    holes = []
    for i in range(5):
        xc = win_x(i)
        arch = arch_pts(hw, ys, hw * 1.9, 0.0, 14)
        holes.append([(xc - hw, WIN['sill'])] + [(xc + x, y) for (x, y) in arch] + [(xc + hw, WIN['sill'])])
    dys = DOOR['h'] - lancet_rise(DOOR['hw'])
    da = arch_pts(DOOR['hw'], dys, DOOR['hw'] * 1.9, 0.0, 14)
    holes.append([(-DOOR['hw'], 0.0)] + da + [(DOOR['hw'], 0.0)])
    outline = [(-HW - WALL, 0.0), (-HW - WALL, SPRING)] + arch_pts(HW, SPRING, RV, WALL, 22) + [(HW + WALL, 0.0)]
    extrude_poly('hp_stone', [outline] + holes, 1.0, lambda u, v, t: S(u, v, L - 1.0 + t))
    for i in range(5):
        xc = win_x(i)
        outer = shift(lancet(hw, WIN['h'], 0.22), xc, WIN['sill'])
        inner = shift(lancet(hw, WIN['h'], 0.0), xc, WIN['sill'])
        extrude_poly('hp_dressed', [outer, inner], 0.14, lambda u, v, t: S(u, v, L - 1.14 + t))
        box('hp_dressed', (xc, WIN['sill'] - 0.06, L - 1.1), (WIN['w'] + 0.7, 0.16, 0.44), bevel=0.02)
    # far doors: surround, threshold, the oak tympanum above the leaves, an iron lintel and a brass boss (the leaves themselves are procedural, hall/fardoor.ts)
    outer = lancet(DOOR['hw'], DOOR['h'], 0.3)
    inner = lancet(DOOR['hw'], DOOR['h'], 0.0)
    extrude_poly('hp_dressed', [outer, inner], 0.16, lambda u, v, t: S(u, v, L - 1.16 + t))
    box('hp_dressed', (0, 0.06, L - 0.5), (2 * DOOR['hw'] + 0.9, 0.12, 1.1), bevel=0.02)
    ty = dys + 0.2
    tym = [(-DOOR['hw'] - 0.01, ty)] + [(x, y) for (x, y) in arch_pts(DOOR['hw'] + 0.01, dys, DOOR['hw'] * 1.9, 0.0, 14) if y >= ty] + [(DOOR['hw'] + 0.01, ty)]
    extrude_poly('hp_wood', [tym], 0.22, lambda u, v, t: S(u, v, L - 0.66 + t))
    box('hp_iron', (0, ty - 0.02, L - 0.62), (2 * DOOR['hw'] + 0.1, 0.2, 0.3), bevel=0.01)
    sphere('hp_brass', (0, ty + 1.0, L - 0.7), 0.22)
    # the dais before the windows
    box('hp_dressed', (0, 0.11, L - 1.8 - 1.0), (2 * HW, 0.22, 3.6), bevel=0.02)
    box('hp_dressed', (0, 0.11, L - 4.7 - 0.2), (2 * HW - 0.8, 0.22, 0.7), bevel=0.02)
    # ---- wall shafts, capitals, transverse arches, ribs
    for j in range(1, BAYS):
        z = zs[j]
        for sg in (-1, 1):
            x = sg * (HW - 0.14)
            lathe('hp_dressed', [(0.001, 0), (0.78, 0), (0.78, 0.2), (0.62, 0.34), (0.5, 0.46), (0.001, 0.46)], (x, 0, z), 16)
            cyl('hp_dressed', (x, 0.46 + (SPRING - 0.96) / 2, z), 0.44, 0.4, SPRING - 0.96, segs=16)
            for dz in (-0.6, 0.6):
                cyl('hp_dressed', (x - sg * 0.06, 0.3 + (SPRING - 0.3) / 2, z + dz), 0.19, 0.17, SPRING - 0.3, segs=10)
                lathe('hp_dressed', [(0.001, 0), (0.26, 0), (0.26, 0.12), (0.17, 0.16), (0.001, 0.16)], (x - sg * 0.06, 0.2, z + dz), 10)
                lathe('hp_dressed', [(0.001, 0), (0.2, 0), (0.3, 0.12), (0.36, 0.3), (0.001, 0.3)], (x - sg * 0.06, SPRING - 0.3, z + dz), 10)
            for r in (2.2, 4.4, 6.6):
                lathe('hp_dressed', [(0.4, 0), (0.5, 0), (0.5, 0.08), (0.4, 0.1)], (x, r, z), 16)
            lathe('hp_dressed', [(0.001, 0), (0.42, 0), (0.55, 0.18), (0.74, 0.34), (0.78, 0.6), (0.001, 0.6)], (x, SPRING - 0.55, z), 16)
        extrude_poly('hp_dressed', [band(0.0, -0.62)], 0.5, lambda u, v, t, z=z: S(u, v, z - 0.25 + t))
    for j in range(BAYS):
        z0, z1 = zs[j], zs[j + 1]
        for d in (0, 1):
            pts = []
            for k in range(17):
                t = k / 16
                x = -HW + 2 * HW * t
                zz = z0 + (z1 - z0) * t if d else z1 - (z1 - z0) * t
                pts.append((x, archy(x, -0.02) - 0.05, zz))
            tube('hp_dressed', pts, 0.12, 6)
        sphere('hp_brass', (0, APEX - 0.12, (z0 + z1) / 2), 0.26)
    tube('hp_dressed', [(0, APEX - 0.05, 0.0), (0, APEX - 0.05, L)], 0.1, 6)
    # ---- banners on the shafts and brass rods
    for j in range(1, BAYS):
        for sg in (-1, 1):
            box('hp_cloth', (sg * (HW - 0.84), 5.6, zs[j]), (0.03, 3.7, 1.0))
            cyl('hp_brass', (sg * (HW - 0.8), 7.5, zs[j]), 0.035, 0.035, 1.2, axis='z', segs=6)
    # ---- long oak tables, benches
    tables = []
    for sg in (-1, 1):
        for (z0, z1) in ((8.0, 14.6), (16.0, 22.0)):
            cx, zc, ln = sg * 5.6, (z0 + z1) / 2, z1 - z0
            tables.append((cx, zc, ln, sg))
            box('hp_wood', (cx, 1.05, zc), (1.7, 0.1, ln), bevel=0.02, seg=2)
            for z in (z0 + 0.9, z1 - 0.9):
                box('hp_wood', (cx - 0.55, 0.5, z), (0.14, 1.0, 1.3), bevel=0.01)
                box('hp_wood', (cx + 0.55, 0.5, z), (0.14, 1.0, 1.3), bevel=0.01)
            box('hp_wood', (cx, 0.3, zc), (1.2, 0.08, ln - 1.6), bevel=0.01)
            for sx in (-1.45, 1.45):
                box('hp_wood', (cx + sx, 0.62, zc), (0.5, 0.08, ln - 0.3), bevel=0.01)
                box('hp_wood', (cx + sx, 0.3, zc), (0.4, 0.6, ln - 1.0), bevel=0.01)
    return tables


# ------------------------------------------------------------------------------------------------ props (Poly Haven, CC0)
def clean_imports():
    for o in list(bpy.data.objects):
        if o.name.startswith(PREFIX):
            bpy.data.objects.remove(o, do_unlink=True)


def import_prop(slug, gltf, tag):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath='%s/%s/%s' % (SRC, slug, gltf))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in new:
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    return meshes


def baked_albedo_of(mat):
    """the base-colour image of an imported glTF material, or None"""
    if not mat or not mat.use_nodes:
        return None, None
    for n in mat.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            bc = n.inputs['Base Color']
            col = tuple(bc.default_value)
            if bc.is_linked:
                src = bc.links[0].from_node
                while src and src.type != 'TEX_IMAGE':
                    ins = [i for i in src.inputs if i.is_linked]
                    src = ins[0].links[0].from_node if ins else None
                return (src.image if src else None), col
            return None, col
    return None, None


def decimate(ob, tris):
    me = ob.data
    n = sum(len(p.vertices) - 2 for p in me.polygons)
    if n <= tris:
        return n
    md = ob.modifiers.new('hp_dec', 'DECIMATE')
    md.ratio = tris / n
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    new = bpy.data.meshes.new_from_object(ev)
    ob.modifiers.remove(md)
    old = ob.data
    ob.data = new
    bpy.data.meshes.remove(old)
    return sum(len(p.vertices) - 2 for p in new.polygons)


def prep_prop(meshes, name, tex_px=512, tris=None):
    """join an imported prop's meshes, give it ONE hp_ material (its own albedo scaled to tex_px) and decimate; returns the object (origin at its base centre, metres)"""
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = PREFIX + name
    me = ob.data
    me.name = PREFIX + name
    # bake world transform into the mesh, drop modifiers
    mw = ob.matrix_world.copy()
    me.transform(mw)
    ob.matrix_world = Matrix.Identity(4)
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    me.uv_layers[0].name = 'uv0'
    mats = [s.material for s in ob.material_slots if s.material]
    img, col = None, None
    for mt in mats:
        im, c = baked_albedo_of(mt)
        if im:
            img, col = im, c
            break
        if c and col is None:
            col = c
    mat, nt, bsdf = new_mat(PREFIX + name)
    if img:
        im2 = shrink(img, tex_px, PREFIX + name + '_albedo')
        im2.colorspace_settings.name = 'sRGB'
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = im2
        uvn = nt.nodes.new('ShaderNodeUVMap')
        uvn.uv_map = 'uv0'
        nt.links.new(uvn.outputs[0], tex.inputs[0])
        nt.links.new(tex.outputs[0], bsdf.inputs['Base Color'])
    elif col:
        bsdf.inputs['Base Color'].default_value = col
    me.materials.clear()
    me.materials.append(mat)
    for p in me.polygons:
        p.material_index = 0
    me.update()
    n = decimate(ob, tris) if tris else sum(len(p.vertices) - 2 for p in me.polygons)
    # origin to the base centre
    xs = [v.co for v in ob.data.vertices]
    cx = sum(v.x for v in xs) / len(xs)
    cy = sum(v.y for v in xs) / len(xs)
    zmin = min(v.z for v in xs)
    ob.data.transform(Matrix.Translation((-cx, -cy, -zmin)))
    return ob, n


def place_copy(src, loc, ry=0.0, scale=1.0, col=None, name=None):
    """a linked copy of a prop standing at hall-local loc (its base), turned ry about the vertical"""
    ob = src.copy()
    ob.data = src.data
    ob.name = PREFIX + (name or 'inst')
    ob.location = S(*loc)
    ob.rotation_euler = Euler((0, 0, ry), 'XYZ')
    ob.scale = (scale, scale, scale)
    (col or bpy.context.scene.collection).objects.link(ob)
    return ob


def collect_size(ob):
    xs = [Vector(c) for c in ob.bound_box]
    return Vector((max(v.x for v in xs) - min(v.x for v in xs), max(v.y for v in xs) - min(v.y for v in xs), max(v.z for v in xs) - min(v.z for v in xs)))


def build_props(tables):
    props = {}
    plan = [
        ('Chandelier_03', 'Chandelier_03_1k.gltf', 'chandelier', 512, 5000),
        ('WoodenChair_01', 'WoodenChair_01_1k.gltf', 'chair', 512, 1800),
        ('brass_candleholders', 'brass_candleholders_1k.gltf', 'candles', 512, 3000),
        ('book_encyclopedia_set_01', 'book_encyclopedia_set_01_1k.gltf', 'books', 512, 1500),
        ('gothic_statue', 'gothic_statue_1k.gltf', 'statue', 512, 9000),
        ('marble_bust_01', 'marble_bust_01_1k.gltf', 'bust', 512, 2200),
    ]
    for slug, gl, name, px, tris in plan:
        if not os.path.exists('%s/%s/%s' % (SRC, slug, gl)):
            log('MISSING prop', slug)
            continue
        ms = import_prop(slug, gl, name)
        ob, n = prep_prop(ms, name, px, tris)
        props[name] = ob
        log('prop', name, 'tris', n, 'size', tuple(round(x, 2) for x in collect_size(ob)))
    return props


def dress(props, tables):
    inst = []
    sc = bpy.context.scene
    col = sc.collection
    lights = []       # (hall-local point, watts) of the candle flames, for the bake and the runtime flame meshes
    flames = []
    # chandeliers hung from the vault
    if 'chandelier' in props:
        ch = props['chandelier']
        sz = collect_size(ch)
        k = 3.0 / max(sz.x, sz.y)
        for z in (6.5, 15.5, 24.5):
            cy = APEX - 3.8 - sz.z * k
            inst.append(place_copy(ch, (0, cy, z), scale=k, name='chandelier'))
            box('hp_iron', (0, (cy + sz.z * k + APEX) / 2, z), (0.05, APEX - cy - sz.z * k, 0.05))
            for a in range(12):
                aa = math.tau * a / 12
                p = (math.cos(aa) * 1.0, cy + sz.z * k * 0.82, z + math.sin(aa) * 1.0)
                flames.append(p)
    # chairs at the ends of each table, turned to the table
    if 'chair' in props:
        chair = props['chair']
        sz = collect_size(chair)
        k = 1.5 / sz.z if sz.z > 0 else 1.0   # ~1.5 m tall carved chairs
        for (cx, zc, ln, sg) in tables:
            for e, ang in ((zc - ln / 2 - 0.55, math.pi), (zc + ln / 2 + 0.55, 0.0)):
                inst.append(place_copy(chair, (cx, 0.0, e), ry=ang + math.pi, scale=k, name='chair'))
    # candle stands + books on the tables
    if 'candles' in props:
        cd = props['candles']
        sz = collect_size(cd)
        k = 0.55 / max(sz.z, 0.01)
        for (cx, zc, ln, sg) in tables:
            for f in (-0.3, 0.3):
                p = (cx + sg * -0.35, 1.1, zc + f * ln / 2)
                inst.append(place_copy(cd, p, ry=0.4 * f, scale=k, name='candles'))
                for dx in (-0.06, 0.0, 0.06):
                    flames.append((p[0] + dx, p[1] + 0.52 * 0.9, p[2]))
    if 'books' in props:
        bk = props['books']
        sz = collect_size(bk)
        k = 0.45 / max(sz.x, 0.01)
        for (cx, zc, ln, sg) in tables:
            inst.append(place_copy(bk, (cx + sg * 0.42, 1.1, zc - ln * 0.05), ry=math.pi / 2 + 0.3 * sg, scale=k, name='books'))
    # two statues on plinths either side of the far doors (the end wall's lower half, which the camera at the hall stop looks straight at)
    if 'statue' in props:
        st = props['statue']
        sz = collect_size(st)
        k = float(A.get('statueh', 2.6)) / max(sz.z, 0.01)
        for sg in (-1, 1):
            x = sg * 4.0
            box('hp_dressed', (x, 0.22 + 0.5, L - 1.7), (1.0, 1.0, 1.0), bevel=0.025, seg=2)
            box('hp_dressed', (x, 0.22 + 1.04, L - 1.7), (1.14, 0.1, 1.14), bevel=0.02)
            inst.append(place_copy(st, (x, 0.22 + 1.09, L - 1.7), ry=math.pi + sg * 0.25, scale=k, name='statue'))
    # a marble bust on a plinth in every bay, down both sides of the nave
    if 'bust' in props:
        bu = props['bust']
        sz = collect_size(bu)
        k = float(A.get('busth', 0.78)) / max(sz.z, 0.01)
        for sg in (-1, 1):
            for j in range(BAYS):
                zc = (BAY * j + BAY * (j + 1)) / 2
                x = sg * (HW - 0.62)
                box('hp_dressed', (x, 0.55, zc), (0.62, 1.1, 0.62), bevel=0.02)
                box('hp_dressed', (x, 1.14, zc), (0.74, 0.08, 0.74), bevel=0.015)
                inst.append(place_copy(bu, (x, 1.18, zc), ry=-sg * math.pi / 2 + (0.18 if (j % 2) else -0.18), scale=k, name='bust'))
    for ob in props.values():
        bpy.data.objects.remove(ob, do_unlink=True)
    return inst, flames


# ------------------------------------------------------------------------------------------------ lighting and the scene
def setup_scene():
    old = bpy.data.scenes.get('hall_photoreal')
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(old)
    sc = bpy.data.scenes.new('hall_photoreal')
    if bpy.context.window:
        bpy.context.window.scene = sc
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = SPP
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 6
    sc.cycles.glossy_bounces = 2
    sc.cycles.transparent_max_bounces = 16
    sc.cycles.sample_clamp_indirect = 8.0
    sc.view_settings.view_transform = 'Standard'
    sc.world = bpy.data.worlds.get('hp_world') or bpy.data.worlds.new('hp_world')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.0, 0.0, 0.0, 1.0)
    bg.inputs['Strength'].default_value = 0.0
    # Strict, like hall_capture.py: this block used to log an exception and carry on, so a missing Metal device meant a silent CPU bake. It stays inline
    # (not m5_preset.apply_prefs) because this file also runs inside the GUI process through the MCP, where sibling imports are unreliable; the values are unchanged.
    cy = bpy.context.preferences.addons['cycles'].preferences
    cy.compute_device_type = 'METAL'
    cy.refresh_devices()
    for d in cy.devices:
        d.use = d.type == 'METAL'
    if not any(d.type == 'METAL' and d.use for d in cy.devices):
        raise RuntimeError('hall_photoreal: no Metal GPU device available; refusing a silent CPU bake')
    return sc


def mesh_obj(name, bm, mat):
    me = bpy.data.meshes.new(PREFIX + name)
    bm.to_mesh(me)
    me.update()
    ob = bpy.data.objects.new(PREFIX + name, me)
    if mat:
        me.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def glass_bake_objects(mats_dict):
    """the five lancet panes at z = L - 0.55 as light sources: transparent (the sun passes, tinted by the picture) + the picture's own glow. X_ objects are not exported."""
    atlas = bpy.data.images.get('hp_glass_atlas')
    if atlas:
        bpy.data.images.remove(atlas)
    atlas = bpy.data.images.load(SRC + '/glass_atlas.png')
    atlas.name = 'hp_glass_atlas'
    atlas.colorspace_settings.name = 'sRGB'
    mat, nt, _ = new_mat('hp_glassbake')
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = atlas
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = float(A.get('glow', 5.0))
    ad = nt.nodes.new('ShaderNodeAddShader')
    # a slightly dimmed picture so the transmitted sun is coloured, not clipped
    nt.links.new(tex.outputs[0], tr.inputs['Color'])
    nt.links.new(tex.outputs[0], em.inputs['Color'])
    nt.links.new(tr.outputs[0], ad.inputs[0])
    nt.links.new(em.outputs[0], ad.inputs[1])
    nt.links.new(ad.outputs[0], out.inputs[0])
    objs = []
    hw = WIN['w'] / 2
    ys = WIN['sill'] + WIN['h'] - lancet_rise(hw)
    for i in range(5):
        xc = win_x(i)
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new('uv0')
        arch = arch_pts(hw, 0, hw * 1.9, 0.0, 14)
        # outline relative to the foot centre: (px, py) with py from 0 to WIN.h
        outline = [(-hw, 0.0)] + [(x, y + WIN['h'] - lancet_rise(hw)) for (x, y) in arch] + [(hw, 0.0)]
        tris = mg.tessellate_polygon([[Vector((x, y, 0)) for (x, y) in outline]])
        vs = [bm.verts.new(S(xc + px, WIN['sill'] + py, L - 0.55)) for (px, py) in outline]
        for t in tris:
            f = bm.faces.new((vs[t[0]], vs[t[1]], vs[t[2]]))
            for l, k in zip(f.loops, t):
                px, py = outline[k]
                l[uvl].uv = ((i + 0.5 - px / WIN['w']) / 5.0, py / WIN['h'])
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        ob = mesh_obj('X_glass%d' % i, bm, mat)
        bm.free()
        ob.name = 'X_glass%d' % i
        objs.append(ob)
    # the six ornamental lancets a side: the procedural panes (amber, gold, maroon cells between lead) sit in the recesses; here they glow amber so the walls and the tables pick it up
    sm, snt, _ = new_mat('hp_sidebake')
    snt.nodes.clear()
    so = snt.nodes.new('ShaderNodeOutputMaterial')
    se = snt.nodes.new('ShaderNodeEmission')
    se.inputs['Color'].default_value = (1.0, 0.5, 0.16, 1.0)
    se.inputs['Strength'].default_value = float(A.get('sideglow', 1.6))
    snt.links.new(se.outputs[0], so.inputs[0])
    for sg in (-1, 1):
        for j in range(BAYS):
            zc = (j + 0.5) * BAY
            outline = lancet(SIDE_PANE['hw'], SIDE_PANE['h'], 0.0, 10)
            tris = mg.tessellate_polygon([[Vector((x, y, 0)) for (x, y) in outline]])
            bm = bmesh.new()
            vs = [bm.verts.new(S(sg * (HW + SIDE_PANE['recess'] - 0.02), SIDE_PANE['y0'] + py, zc + px)) for (px, py) in outline]
            for t in tris:
                bm.faces.new((vs[t[0]], vs[t[1]], vs[t[2]]))
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            ob = mesh_obj('X_side%d_%d' % (sg, j), bm, sm)
            bm.free()
            ob.name = 'X_side%d_%d' % (sg, j)
            # face the room
            n = ob.data.polygons[0].normal
            if n.x * sg > 0:
                bmesh_flip = ob.data
                bmesh_flip.flip_normals()
            objs.append(ob)
    return objs


def add_light(kind, name, loc, energy, color=(1, 1, 1), size=0.1, rot=None, spot=None):
    ld = bpy.data.lights.new(PREFIX + name, kind)
    ld.energy = energy
    ld.color = color
    if kind == 'AREA':
        ld.shape = 'DISK' if A.get('disk') else 'RECTANGLE'
        ld.size = size
        ld.size_y = size
    elif kind == 'POINT':
        ld.shadow_soft_size = size
    elif kind == 'SUN':
        ld.angle = size
    ob = bpy.data.objects.new('X_' + name, ld)
    ob.location = S(*loc) if loc else (0, 0, 0)
    if rot is not None:
        ob.rotation_euler = rot
    bpy.context.scene.collection.objects.link(ob)
    return ob


def build_lights(flames):
    # the sun, behind the end wall, shining through the glass: travels along -SUN_TO (hall-local), so floor patches fall where the analytic ones do
    d = Vector((-SUN_TO[0], -SUN_TO[1], -SUN_TO[2]))
    travel = S(*d)           # a direction: S maps x, y, z the same way
    rot = Vector((0, 0, -1)).rotation_difference(travel).to_euler()
    ld = add_light('SUN', 'sun', (0, 20, L + 10), float(A.get('sun', 5.0)), (1.0, 0.97, 0.9), size=math.radians(float(A.get('sunangle', 1.2))), rot=rot)
    # candles
    n = 0
    for p in flames:
        add_light('POINT', 'candle%d' % n, p, float(A.get('candle', 14.0)), (1.0, 0.62, 0.28), size=0.04)
        n += 1
    # a faint warm fill in the nave (the old hall's two warm point lights, hall/rig.ts)
    for z in (8.0, 22.0):
        add_light('AREA', 'fill%d' % int(z), (0, 12.0, z), float(A.get('fill', 15.0)), (1.0, 0.72, 0.45), size=4.0, rot=(0, 0, 0))
    # the glow of each lancet on the stone round it (the glass is coplanar with the wall, so its own emission cannot light the wall it sits in): a coloured soft point a little
    # in front of each window. This is the baked version of the procedural hall's resting window light (hall/material.ts uWinI 0.28)
    for i in range(5):
        add_light('POINT', 'halo%d' % i, (win_x(i), WIN['sill'] + WIN['h'] * 0.46, L - 1.3), float(A.get('halo', 420.0)), LIGHT[i], size=0.7)
    # and a wash: the same colour from further out, so it reaches the wall below the sills, the dais and the vault ribs as a soft coloured haze
    for i in range(5):
        add_light('POINT', 'wash%d' % i, (win_x(i), WIN['sill'] + 3.0, L - 3.4), float(A.get('wash', 220.0)), LIGHT[i], size=1.2)
    # a warm spill from the open doors at the near end
    add_light('AREA', 'doorspill', (0, 3.0, 0.4), float(A.get('door', 90.0)), (1.0, 0.72, 0.42), size=3.0, rot=Euler((-math.pi / 2, 0, 0)))


def occluders():
    """closed ends so the bake keeps its light: the near wall behind the doors, and a black backing in the far-door opening (neither is exported)"""
    bm = B.get('X_near')
    box('X_near', (0, 8, -0.1), (2 * (HW + WALL), 24, 0.2))
    box('X_doorback', (0, 3, L + 0.1), (2 * DOOR['hw'] + 0.2, 7, 0.1))


def look_cam(name, pos, target, fov):
    cd = bpy.data.cameras.new(PREFIX + name)
    cd.angle = math.radians(fov)
    ob = bpy.data.objects.new('X_' + name, cd)
    ob.location = S(*pos)
    d = S(*target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ------------------------------------------------------------------------------------------------ stages
def stage_build():
    B.reset()
    clean_imports()
    sc = setup_scene()
    mats = make_materials()
    tables = build_architecture()
    occluders()
    props = build_props(tables)
    inst, flames = dress(props, tables)
    objs = {}
    for m, bm in list(B.bms.items()):
        if m.startswith('X_'):
            continue
        if m in TILE:
            assign_uv0(bm, TILE[m][1])
        else:
            assign_uv0(bm, 2.0)
        objs[m] = mesh_obj(m, bm, mats[m])
    for m in ('X_near', 'X_doorback'):
        ob = mesh_obj(m, B.bms[m], mats['hp_door'])
        ob.name = m
    glass_bake_objects(mats)
    build_lights(flames)
    # the camera views used to judge the bake
    look_cam('cam_hall', (0, 3.6, 18.0), (0, 8.6, L), 46)
    look_cam('cam_nave', (0, 2.6, 2.0), (0, 7.0, 30), 60)
    look_cam('cam_dais', (4.0, 2.0, 24.0), (-2.0, 6.0, L), 60)
    sc.camera = bpy.data.objects['X_cam_hall']
    # flames (exported, not baked): small cones on the candle points
    bm = B.get('hp_flame')
    for p in flames:
        cyl('hp_flame', (p[0], p[1] + 0.03, p[2]), 0.018, 0.0, 0.1, segs=6)
    mo = mesh_obj('flames', bm, mats['hp_flame'])
    mo.name = PREFIX + 'flames'
    json.dump({'flames': flames}, open(OUT + '/flames.json', 'w'))
    log('build done: objects', len([o for o in sc.objects]), 'tris(arch)', sum(len(bm.faces) for bm in B.bms.values()))
    return sc


def cull_hidden(ob):
    """drop every face that no one can see from inside the hall: a ray from just above the face along its normal must hit the FRONT of something (a face whose ray escapes
    faces the void, a face whose ray first meets a back face is buried in a solid). The near wall and the far-door backing are part of the test (the hall is closed)."""
    from mathutils.bvhtree import BVHTree
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    # decide per patch, not per big face: cut every edge longer than 1.3 m first (a 60 m2 floor quad whose middle sits under the runner would otherwise vanish whole)
    for _ in range(6):
        long_e = [e for e in bm.edges if e.calc_length() > 0.9]
        if not long_e:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_e, cuts=1, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    probe = bm.copy()
    for (c, size) in (((0, 8, -0.1), (2 * (HW + WALL), 24, 0.2)), ((0, 3, L + 0.1), (2 * DOOR['hw'] + 0.2, 7, 0.1))):
        vs = bmesh.ops.create_cube(probe, size=1.0)['verts']
        bmesh.ops.transform(probe, matrix=Matrix.Translation(S(*c)) @ Matrix.Diagonal((size[0], size[2], size[1], 1.0)), verts=vs)
    probe.normal_update()
    bvh = BVHTree.FromBMesh(probe)
    bm.normal_update()
    kill = []
    why = {}
    mats = [m.name for m in me.materials]

    def visible(f, n):
        # a face stays if ANY of a handful of samples (its middle and points toward each corner) sees the room: a long sliver's middle can sit under a moulding while its end is in plain view
        c = f.calc_center_median()
        pts = [c] + [c + (l.vert.co - c) * 0.75 for l in f.loops]
        void = False
        for p in pts:
            loc, hn, idx, dist = bvh.ray_cast(p + n * 0.004, n)
            if loc is not None and hn.dot(n) <= 0.0:
                return 1
            void = void or loc is None
        return 0 if not void else -1
    for f in bm.faces:
        v = visible(f, f.normal)
        if v <= 0:
            kill.append(f)
            key = (mats[f.material_index], 'void' if v < 0 else 'buried')
            why[key] = why.get(key, 0) + 1
    log('cull reasons', {'%s/%s' % k: v for k, v in sorted(why.items())})
    before = len(bm.faces)
    ks = set(kill)
    for f in bm.faces:
        if f not in ks and f.calc_area() < 2e-6:
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    # loose verts / edges left behind
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(me)
    bm.free()
    probe.free()
    me.update()
    log('culled', len(kill), 'of', before, 'faces')


PROP_MATS = ('hp_chandelier', 'hp_chair', 'hp_candles', 'hp_books', 'hp_statue', 'hp_bust')


def _join(objs, name):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        if o.data.users > 1:
            o.data = o.data.copy()
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = PREFIX + name
    ob.data.name = PREFIX + name
    return ob


def island_weights(hall):
    """scale each lightmap island by how much it matters on screen: the end wall and the floor in front of it get the texels, the vault and the near nave few.
    (islands = faces joined across an edge whose UVs agree; weight by material and the island's place in the hall)"""
    me = hall.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    uvl = bm.loops.layers.uv['lm']
    parent = list(range(len(bm.faces)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for e in bm.edges:
        if len(e.link_faces) != 2:
            continue
        f1, f2 = e.link_faces
        ok = True
        for v in e.verts:
            l1 = next(l for l in f1.loops if l.vert == v)
            l2 = next(l for l in f2.loops if l.vert == v)
            if (l1[uvl].uv - l2[uvl].uv).length > 2e-5:
                ok = False
                break
        if ok:
            ra, rb = find(f1.index), find(f2.index)
            if ra != rb:
                parent[ra] = rb
    groups = {}
    for f in bm.faces:
        groups.setdefault(find(f.index), []).append(f)
    mats = [m.name for m in me.materials]

    def weight(faces):
        c = Vector((0, 0, 0))
        a = 0.0
        for f in faces:
            ar = f.calc_area()
            c += f.calc_center_median() * ar
            a += ar
        c /= max(a, 1e-9)
        x, y, z = c.x, c.z, -c.y
        mat = mats[faces[0].material_index]
        if z > L - 1.6:
            return 1.9 if mat in ('hp_stone', 'hp_dressed') else 1.0
        if mat == 'hp_plaster':
            return 0.42
        if mat == 'hp_floor':
            return 0.45 if z < 12 else (0.7 if z < 17 else 1.15)
        if mat in ('hp_stone', 'hp_panel') and abs(x) > HW - 0.5:
            return 0.5 if z < 12 else 0.85
        if mat == 'hp_dressed' and z > L - 6:
            return 1.3
        if y > 7.0:
            return 0.5
        return 0.7 if z < 12 else 0.9
    n = 0
    for faces in groups.values():
        w = weight(faces)
        us = [l[uvl].uv for f in faces for l in f.loops]
        cx = (min(u.x for u in us) + max(u.x for u in us)) / 2
        cy = (min(u.y for u in us) + max(u.y for u in us)) / 2
        for f in faces:
            for l in f.loops:
                u = l[uvl].uv
                l[uvl].uv = (cx + (u.x - cx) * w, cy + (u.y - cy) * w)
        n += 1
    bm.to_mesh(me)
    bm.free()
    me.update()
    log('island weights on', n, 'islands')


def stage_unwrap():
    sc = bpy.data.scenes['hall_photoreal']
    if bpy.context.window:
        bpy.context.window.scene = sc
    parts = [o for o in sc.objects if o.type == 'MESH' and o.name.startswith(PREFIX) and o.name not in (PREFIX + 'flames', PREFIX + 'hall', PREFIX + 'props')]
    is_prop = lambda o: o.data.materials and o.data.materials[0] and o.data.materials[0].name in PROP_MATS
    arch = [o for o in parts if not is_prop(o)]
    props = [o for o in parts if is_prop(o)]
    # architecture: one object, one packed lightmap (UV layer 'lm', second); props: one object, light baked into vertex colours
    for o in arch + props:
        me = o.data
        if 'uv0' not in me.uv_layers:
            me.uv_layers.new(name='uv0')
    for o in arch:
        me = o.data
        if 'lm' in me.uv_layers:
            me.uv_layers.remove(me.uv_layers['lm'])
        me.uv_layers.new(name='lm')
    hall = _join(arch, 'hall')
    me = hall.data
    cull_hidden(hall)
    me = hall.data
    me.uv_layers.active = me.uv_layers['lm']
    me.uv_layers['uv0'].active_render = True
    tri = lambda m: sum(len(p.vertices) - 2 for p in m.polygons)
    log('hall: tris', tri(me), 'materials', [m.name for m in me.materials])
    for o in sc.objects:
        o.select_set(False)
    hall.select_set(True)
    bpy.context.view_layer.objects.active = hall
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode='OBJECT')
    island_weights(hall)
    hall.data.uv_layers.active = hall.data.uv_layers['lm']
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(margin=0.0012, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    if props:
        pr = _join(props, 'props')
        log('props: tris', tri(pr.data), 'materials', [m.name for m in pr.data.materials])
    log('unwrap done')
    return hall


def stage_bake():
    sc = bpy.data.scenes['hall_photoreal']
    if bpy.context.window:
        bpy.context.window.scene = sc
    hall = bpy.data.objects[PREFIX + 'hall']
    me = hall.data
    me.uv_layers.active = me.uv_layers['lm']
    img = bpy.data.images.get('hp_lightmap')
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new('hp_lightmap', RES, RES, alpha=False, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    for mat in me.materials:
        nt = mat.node_tree
        for n in [n for n in nt.nodes if n.name.startswith('LM_TARGET')]:
            nt.nodes.remove(n)
        tn = nt.nodes.new('ShaderNodeTexImage')
        tn.name = 'LM_TARGET'
        tn.image = img
        for n in nt.nodes:
            n.select = (n.name == tn.name)
        nt.nodes.active = tn
    sc.cycles.samples = SPP
    b = sc.render.bake
    b.use_pass_direct = True
    b.use_pass_indirect = True
    b.use_pass_color = False
    b.margin = 6
    b.margin_type = 'EXTEND'
    b.use_clear = True
    b.target = 'IMAGE_TEXTURES'
    for o in sc.objects:
        o.select_set(False)
    hall.select_set(True)
    bpy.context.view_layer.objects.active = hall
    t = time.time()
    bpy.ops.object.bake(type='DIFFUSE')
    log('hall bake %.1fs' % (time.time() - t), 'spp', SPP, 'res', RES)
    img.filepath_raw = OUT + '/lightmap_linear.exr'
    img.file_format = 'OPEN_EXR'
    img.save()
    pr = bpy.data.objects.get(PREFIX + 'props')
    if pr:
        me = pr.data
        for a in list(me.color_attributes):
            me.color_attributes.remove(a)
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        me.color_attributes.active_color = ca
        me.color_attributes.render_color_index = 0
        b.target = 'VERTEX_COLORS'
        for o in sc.objects:
            o.select_set(False)
        pr.select_set(True)
        bpy.context.view_layer.objects.active = pr
        t = time.time()
        bpy.ops.object.bake(type='DIFFUSE')
        log('props bake %.1fs' % (time.time() - t), 'verts', len(me.vertices))
    return img


def _tone(v):
    """display shoulder on the brightest channel (hue and saturation keep): linear to 0.5, then a soft roll-off to 1.0"""
    import numpy as np
    return np.where(v <= 0.5, v, 0.5 + 0.5 * (1.0 - np.exp(-(v - 0.5) / 0.5)))


def _oetf(x):
    import numpy as np
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def _encode(rgb, E):
    """linear radiance of a white diffuse surface -> display-referred 0..1 (what the site multiplies the photograph's own colours by)"""
    import numpy as np
    v = rgb * E
    m = np.max(v, axis=-1, keepdims=True)
    k = np.where(m > 1e-6, _tone(m) / np.maximum(m, 1e-6), 1.0)
    return _oetf(v * k)


def _denoise(px, rounds=3, sr=0.28):
    """edge-aware a-trous smoothing of the baked lightmap (Cycles' bake has no denoiser): relative luminance difference sets the weight, so shadows edges and window light stay"""
    import numpy as np
    k1 = (1.0, 4.0, 6.0, 4.0, 1.0)
    w709 = np.array([0.2126, 0.7152, 0.0722], np.float32)
    out = px.astype(np.float32)
    for r in range(rounds):
        step = 1 << r
        lum = out @ w709
        acc = np.zeros_like(out)
        wsum = np.zeros(out.shape[:2], np.float32)
        for iy, dy in enumerate(range(-2, 3)):
            for ix, dx in enumerate(range(-2, 3)):
                sh = np.roll(out, (dy * step, dx * step), axis=(0, 1))
                sl = np.roll(lum, (dy * step, dx * step), axis=(0, 1))
                d = np.abs(sl - lum) / (sl + lum + 1e-3)
                w = (k1[iy] * k1[ix]) * np.exp(-(d / sr) ** 2)
                acc += sh * w[..., None]
                wsum += w
        out = acc / np.maximum(wsum, 1e-6)[..., None]
    return out


def stage_export():
    import numpy as np
    sc = bpy.data.scenes['hall_photoreal']
    if bpy.context.window:
        bpy.context.window.scene = sc
    img = bpy.data.images.get('hp_lightmap')
    if img is None or not img.has_data:
        img = bpy.data.images.load(OUT + '/lightmap_linear.exr')
        img.name = 'hp_lightmap'
    W, H = img.size
    buf = np.empty(W * H * 4, np.float32)
    img.pixels.foreach_get(buf)
    px = buf.reshape(H, W, 4)[:, :, :3]
    if not A.get('nodenoise'):
        t = time.time()
        px = _denoise(px)
        log('denoise %.1fs' % (time.time() - t))
    lum = px @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    lit = lum[lum > 1e-4]
    pc = {k: float(np.percentile(lit, k)) for k in (5, 25, 50, 75, 95, 99, 99.9)}
    E = float(A.get('exposure') or (float(A.get('lmmed')) / pc[50] if A.get('lmmed') else 1.3))      # a fixed exposure (1.3: the median lit texel lands near 0.22 linear, 0.5 as displayed); --lmmed M normalises the median instead
    out = _encode(px, E)
    # the lightmap as a display-referred 8-bit WebP, saved through an image whose colour space does nothing
    lm = bpy.data.images.get('hp_lm_display')
    if lm:
        bpy.data.images.remove(lm)
    lm = bpy.data.images.new('hp_lm_display', W, H, alpha=False)
    lm.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((H, W, 4), np.float32)
    rgba[:, :, :3] = out
    lm.pixels.foreach_set(rgba.ravel())
    lm.file_format = 'WEBP'
    lm.save(filepath=OUT + '/hall_light.webp', quality=int(A.get('lmq') or 90))
    log('lightmap', W, H, 'E', round(E, 3), 'percentiles', {k: round(v, 4) for k, v in pc.items()}, 'bytes', os.path.getsize(OUT + '/hall_light.webp'))
    # the props: vertex colours -> the same display encode
    pr = bpy.data.objects.get(PREFIX + 'props')
    if pr:
        me = pr.data
        ca = me.color_attributes.get('Col')
        n = len(me.vertices)
        vb = np.empty(n * 4, np.float32)
        # the linear light is kept in a plain vector attribute (not a colour attribute: the glTF exporter would write every colour attribute as COLOR_n)
        lin = me.attributes.get('hp_lin')
        if lin is None:                      # first export after a bake: keep the linear light, so a re-export (another exposure) starts from it
            ca.data.foreach_get('color', vb)
            lin = me.attributes.new('hp_lin', 'FLOAT_VECTOR', 'POINT')
            lin.data.foreach_set('vector', np.ascontiguousarray(vb.reshape(n, 4)[:, :3]).ravel())
        lv = np.empty(n * 3, np.float32)
        lin.data.foreach_get('vector', lv)
        vb = np.concatenate([lv.reshape(n, 3), np.ones((n, 1), np.float32)], axis=1).ravel()
        v = vb.reshape(n, 4)
        v[:, :3] = _encode(v[:, :3], E)
        v[:, 3] = 1.0
        ca.data.foreach_set('color', v.ravel())
        me.color_attributes.active_color = ca
        me.update()
    # export the three objects as one Draco + WebP GLB
    for o in sc.objects:
        o.select_set(False)
    names = [PREFIX + 'hall', PREFIX + 'props', PREFIX + 'flames']
    objs = [bpy.data.objects[n] for n in names if bpy.data.objects.get(n)]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = OUT + '/hall-photoreal.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False, export_materials='EXPORT',
                              export_image_format='WEBP', export_image_quality=int(A.get('texq') or 80), export_texcoords=True, export_normals=True, export_vertex_color='ACTIVE',
                              export_cameras=False, export_lights=False, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=16,
                              export_draco_color_quantization=8, export_draco_generic_quantization=12)
    data = open(path, 'rb').read()
    jl = struct.unpack('<I', data[12:16])[0]
    js = json.loads(data[20:20 + jl])
    stats = {'glb_bytes': len(data), 'lightmap_bytes': os.path.getsize(OUT + '/hall_light.webp'), 'exposure': E, 'percentiles': pc,
             'tris': {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs},
             'materials': [m['name'] for m in js['materials']], 'images': [(i.get('name'), i.get('mimeType')) for i in js.get('images', [])],
             'meshes': [(m.get('name'), [(pp.get('material'), sorted(pp['attributes'].keys())) for pp in m['primitives']]) for m in js['meshes']]}
    json.dump(stats, open(OUT + '/stats.json', 'w'), indent=1)
    log('export', json.dumps({k: v for k, v in stats.items() if k in ('glb_bytes', 'lightmap_bytes', 'tris')}))
    return stats


STAGE_FNS = {'build': stage_build, 'unwrap': stage_unwrap, 'bake': stage_bake, 'export': stage_export}
for st in STAGES:
    if st in STAGE_FNS:
        log('--- stage', st)
        STAGE_FNS[st]()
