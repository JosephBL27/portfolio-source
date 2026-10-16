# The Education stop's chalkboard (wave 24 r6, replaces the r5 board): a classroom slate board in a worn oak frame, with a chalk ledge, chalk
# sticks (white, one pale pink, one pale blue) and a felt eraser, on a dark plaster wall that falls away to black. Modelled and Cycles-baked headless.
# The slate itself (grain, the cloudy residue of old erasures, the chalk) is painted on the site (src/v3/world/extras/stages/chalkboard.ts), so nothing
# here is text.
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/chalkboard.py -- <out.glb> <assets-src dir>
# Site coordinates through lib.S() (x right, y up, z toward the viewer). The writing area is PW x PH centred on the origin; the FRONT of the frame is the
# plane z = 0, the slate face sits LIP behind it, the wall WALL_Z behind.
# STRETCHABLE: the site re-proportions the board for a phone (a taller, narrower board) by moving vertices, never by scaling objects:
#   x' = x + dx * clamp(x / (PW / 2), -1, 1)   (and the same in y with PH)
# so everything inside the writing area scales and everything outside it (the rails, the ledge, the wall's edges) shifts rigidly. The rails are plain
# butt-jointed boxes (top and bottom rails run the full width, the stiles sit between them) so a shift keeps every joint closed. The chalk and the
# eraser are rigid parts: the site moves their centres through the same map.
# Materials: oak = Poly Haven "Oak Veneer 01" (CC0, Jenelle van Heerden), exported as WebP maps; the grain runs along each rail. Chalk, felt and the
# wall get their final materials on the site. Ambient occlusion is Cycles-baked into COLOR_0 (lib.bake_ao, M5 preset); the wall's COLOR_0 also
# carries the light-pool falloff (display-referred: the site multiplies it straight into the indirect light).
import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import S
import m5_preset

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, SRC = argv[0], argv[1]

# ---- dimensions (keep in step with src/v3/world/extras/stages/chalkboard.ts) ----
PW, PH = 3.2, 2.0                    # the writing area
FW = 0.085                           # rail width (face)
FD = 0.06                            # rail depth (front plane z = 0 back to z = -FD)
LIP = 0.014                          # the slate sits this far behind the rails' front
FOW, FOH = PW + 2 * FW, PH + 2 * FW
WALL_Z = -(FD + 0.006)
LEDGE_D, LEDGE_T = 0.13, 0.03        # the chalk ledge: depth out from the wall, thickness
LEDGE_L = FOW + 0.06
LEDGE_TOP = -FOH / 2 - 0.005         # its top sits just under the bottom rail
CH_R = 0.0105                        # a chalk stick: radius (a little over scale so it reads at 900 px)

sc = lib.setup(samples=64)
m5_preset.apply_prefs(quiet=True)
print('M5', m5_preset.apply(sc, 'lookdev'))
sc.cycles.samples = 64


def img(path, data=False, size=512):
    im = bpy.data.images.load(path)
    if data:
        im.colorspace_settings.name = 'Non-Color'
    if im.size[0] > size:
        im.scale(size, size)
    return im


def pbr(name, base=(0.8, 0.8, 0.8), metal=0.0, rough=0.5, col=None, rmap=None, nmap=None, nstrength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    if col:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = col
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    if rmap:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = rmap
        nt.links.new(t.outputs['Color'], bsdf.inputs['Roughness'])
    if nmap:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = nmap
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = nstrength
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return m


OAK = os.path.join(SRC, 'oak_veneer_01')
oak = pbr('oak', base=(0.8, 0.8, 0.8), rough=0.55,
          col=img(f'{OAK}/oak_veneer_01_diff_1k.jpg', size=1024), rmap=img(f'{OAK}/oak_veneer_01_rough_1k.jpg', True),
          nmap=img(f'{OAK}/oak_veneer_01_nor_gl_1k.jpg', True), nstrength=0.8)
slate_m = pbr('slate', base=(0.03, 0.04, 0.036), rough=0.7)
wall_m = pbr('wall', base=(0.16, 0.16, 0.155), rough=0.92)
chalk_m = {k: pbr('chalk_' + k, base=v, rough=1.0) for k, v in (('white', (0.86, 0.86, 0.83)), ('pink', (0.86, 0.62, 0.64)), ('blue', (0.6, 0.72, 0.86)))}
felt_m = pbr('felt', base=(0.45, 0.45, 0.44), rough=1.0)
eback_m = pbr('eraser_back', base=(0.42, 0.3, 0.2), rough=0.6)


def assign(ob, m):
    ob.data.materials.clear()
    ob.data.materials.append(m)
    return ob


def made(bm, fn, *a, **k):
    before = set(bm.verts)
    fn(bm, *a, **k)
    return [v for v in bm.verts if v not in before]


def wood_uv(bm, scale, along='x'):
    """box-projected UVs (like lib.planar_uv) with the texture's grain (its v axis) laid along `along`: rails along x get u/v swapped"""
    layer = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda k: abs(n[k]))
        for l in f.loops:
            p = l.vert.co
            sx, sy, sz = p.x, p.z, -p.y
            if ax == 2:      # top / bottom (site y): (x, z)
                u, v = sz, sx
                if along == 'y':
                    u, v = sx, sz
            elif ax == 0:    # site x faces: (z, y)
                u, v = sz, sy
            else:            # front / back (site z): (x, y)
                u, v = sy, sx
                if along == 'y':
                    u, v = sx, sy
            l[layer].uv = (u / scale + 0.37, v / scale + 0.11)


parts = []

# ---- the slate: a slab, front face on z = -LIP, uv 0..1 over the writing area (the site paints it) ----
bm = bmesh.new()
lib.add_box(bm, (0, 0, -LIP - 0.01), (PW + 0.04, PH + 0.04, 0.02), bevel=0.0, seg=1)
parts.append(assign(lib.part('board_face', bm, dense=0.0, uv=(PW, PH)), slate_m))

# ---- the oak frame: top and bottom rails run the full width, the stiles sit between them; worn rounded edges ----
bm = bmesh.new()
for sy in (-1, 1):
    lib.add_box(bm, (0, sy * (PH / 2 + FW / 2), -FD / 2), (FOW, FW, FD), bevel=0.009, seg=3)
fh = lib.part('frame_h', bm, dense=0.35, smooth_angle=0.6)
bm = bmesh.new(); bm.from_mesh(fh.data); wood_uv(bm, 1.25, 'x'); bm.to_mesh(fh.data); bm.free()
parts.append(assign(fh, oak))
bm = bmesh.new()
for sx in (-1, 1):
    lib.add_box(bm, (sx * (PW / 2 + FW / 2), 0, -FD / 2), (FW, PH, FD), bevel=0.009, seg=3)
fv = lib.part('frame_v', bm, dense=0.35, smooth_angle=0.6)
bm = bmesh.new(); bm.from_mesh(fv.data); wood_uv(bm, 1.25, 'y'); bm.to_mesh(fv.data); bm.free()
parts.append(assign(fv, oak))

# ---- the chalk ledge: a shelf under the bottom rail with a low front lip, on two small brackets ----
bm = bmesh.new()
lz = WALL_Z + LEDGE_D / 2
lib.add_box(bm, (0, LEDGE_TOP - LEDGE_T / 2, lz), (LEDGE_L, LEDGE_T, LEDGE_D), bevel=0.006, seg=2)
lib.add_box(bm, (0, LEDGE_TOP + 0.009, WALL_Z + LEDGE_D - 0.008), (LEDGE_L, 0.018, 0.016), bevel=0.005, seg=2)
for sx in (-1, 1):
    lib.add_box(bm, (sx * (LEDGE_L / 2 - 0.25), LEDGE_TOP - LEDGE_T - 0.045, WALL_Z + 0.035), (0.03, 0.09, 0.07), bevel=0.006, seg=2)
le = lib.part('ledge', bm, dense=0.3, smooth_angle=0.6)
bm = bmesh.new(); bm.from_mesh(le.data); wood_uv(bm, 1.25, 'x'); bm.to_mesh(le.data); bm.free()
parts.append(assign(le, oak))

# ---- chalk: sticks lying on the ledge, one worn to a slant where it was written with, two broken stubs, a pink and a blue ----
ty = LEDGE_TOP + CH_R + 0.0004


def stick(bm, x, z, L, yaw, worn=0.0):
    c = (x, ty, z)
    vs = made(bm, lib.add_cyl, c, CH_R, L, axis='x', segs=18, bevel=CH_R * 0.35, bseg=2)
    if worn:
        # the writing end, worn to a slant: pull the +x end's top back
        for v in vs:
            p = lib.site_of(v.co)
            if p[0] > x + L / 2 - CH_R * 1.2:
                k = (p[1] - (ty - CH_R)) / (2 * CH_R)
                v.co = S(p[0] - worn * k, p[1], p[2])
    bmesh.ops.rotate(bm, verts=vs, cent=S(*c), matrix=Matrix.Rotation(yaw, 3, 'Z'))
    return vs


chalks = {}
CH = {'white': [(-1.16, 0.0, 0.17, 0.12, 0.012), (-0.98, 0.012, 0.075, -0.3, 0.0), (0.62, -0.006, 0.055, 0.5, 0.0)],
      'pink': [(-0.84, -0.008, 0.13, -0.06, 0.008)],
      'blue': [(0.78, 0.01, 0.1, 0.16, 0.0)]}
for k, lst in CH.items():
    bm = bmesh.new()
    for x, dz, L, yaw, worn in lst:
        stick(bm, x, lz + dz, L, yaw, worn)
    ob = lib.part('chalk_' + k, bm, dense=0.0, smooth_angle=0.9)
    parts.append(assign(ob, chalk_m[k]))
    chalks[k] = ob

# ---- the felt eraser: a wooden back with a grey felt pad underneath, lying on the ledge ----
ex, ez, eyaw = 1.05, lz - 0.004, math.radians(-6)
EL, EH, ED = 0.27, 0.05, 0.095
bm = bmesh.new()
vb = made(bm, lib.add_box, (ex, LEDGE_TOP + 0.022 + EH * 0.5 - 0.004, ez), (EL, EH * 0.62, ED), bevel=0.012, seg=3)
bmesh.ops.rotate(bm, verts=vb, cent=S(ex, LEDGE_TOP, ez), matrix=Matrix.Rotation(eyaw, 3, 'Z'))
parts.append(assign(lib.part('eraser_body', bm, dense=0.0, smooth_angle=0.8), eback_m))
bm = bmesh.new()
vf = made(bm, lib.add_box, (ex, LEDGE_TOP + 0.011, ez), (EL - 0.006, 0.022, ED - 0.006), bevel=0.004, seg=2)
bmesh.ops.rotate(bm, verts=vf, cent=S(ex, LEDGE_TOP, ez), matrix=Matrix.Rotation(eyaw, 3, 'Z'))
parts.append(assign(lib.part('eraser_felt', bm, dense=0.0, smooth_angle=0.8), felt_m))

# ---- the wall: a dense plane the board casts its shadow on; the light pool falls to black at its edges ----
WALL_W, WALL_H = 11.0, 7.5
bm = bmesh.new()
lib.add_box(bm, (0, 0, WALL_Z - 0.01), (WALL_W, WALL_H, 0.02), bevel=0.0, seg=1)
wall = assign(lib.part('wall', bm, dense=0.09, coarse=0.7, near=lambda p: abs(p[0]) < 2.2 and abs(p[1]) < 1.5), wall_m)
parts.append(wall)

# ---- bake AO into COLOR_0 (everything occludes everything) ----
lib.bake_ao(parts, dist=0.5, gamma=1.0, floor=0.2, hide=(), smooth=2)
# the wall: a raking light pool from the upper left on top of the contact shadow (falls to 0 = the page's black)
me = wall.data
ca = me.color_attributes.active_color
n = len(me.vertices)
buf = [0.0] * (n * 4)
ca.data.foreach_get('color', buf)
for i, v in enumerate(me.vertices):
    sx, sy = v.co.x, v.co.z
    r = math.hypot((sx + 0.35) / 3.3, (sy - 0.1) / 2.2)
    fall = max(0.0, min(1.0, 1.0 - (r - 0.45) / 0.8))
    fall = fall * fall * (3 - 2 * fall)
    for k in range(3):
        buf[i * 4 + k] *= fall
ca.data.foreach_set('color', buf)
me.update()

# ---- export: Draco geometry, WebP images ----
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
kw = dict(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
          export_materials='EXPORT', export_image_format='WEBP', export_image_quality=80, export_texcoords=True, export_normals=True,
          export_cameras=False, export_lights=False,
          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7, export_draco_position_quantization=14,
          export_draco_normal_quantization=10, export_draco_texcoord_quantization=12, export_draco_color_quantization=8, export_draco_generic_quantization=12)
try:
    bpy.ops.export_scene.gltf(export_vertex_color='ACTIVE', **kw)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
print('EXPORT_OK', OUT, os.path.getsize(OUT), 'bytes')
for o in parts:
    print('PART', o.name, len(o.data.polygons), 'faces')
