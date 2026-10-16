# The QVR stop's "Volatility Instrument" (wave 22 r4): a museum desk object. A walnut plinth on a shadow-gap foot, a brushed aluminium deck the pins
# rise through, machined rails for the strike and maturity scales, a vertical implied-vol post, a front fascia with three knurled brass dials on
# circular-brushed dial faces, a thin glass vitrine, and ONE pin (the site instances it 40 x 28 times, src/v3/world/extras/stages/qvr.ts).
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/qvr_instrument.py -- <out.glb> <assets-src dir> [hdr_out]
# Site coordinates through lib.S() (x right, y up, z toward the viewer); the deck top is y = 0, the pin grid is centred on x = z = 0.
# Materials are exported (Principled BSDF -> glTF PBR, images as WebP): walnut = Poly Haven "Dark Wood" (CC0), brushed aluminium = ambientCG Metal009 (CC0),
# circular-brushed dial faces = ambientCG Metal051A (CC0). Ambient occlusion is Cycles-baked into COLOR_0 (lib.bake_ao; the site multiplies it into
# the indirect light, glbmodel.withAO). The vitrine and the brass get their final materials on the site (no transmission pass there).
# Optional: hdr_out writes a 512 x 256 copy of Poly Haven "Studio Small 09" (CC0) for the stop's PMREM.
import bpy, bmesh, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import S

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, SRC = argv[0], argv[1]
HDR_OUT = argv[2] if len(argv) > 2 else None

# ---- dimensions (keep in step with src/v3/world/extras/stages/qvr.ts) ----
NX, NZ, P = 40, 28, 0.13
AX, AZ = (NX - 1) * P, (NZ - 1) * P              # 5.07 x 3.51: pin centres
DECK_W, DECK_D, DECK_T = AX + 0.62, AZ + 0.62, 0.05
PL_W, PL_D, PL_Y0, PL_Y1 = 6.5, 5.0, -0.62, -DECK_T   # walnut body
PL_Z0, PL_Z1 = -AZ / 2 - 0.62, AZ / 2 + 0.95        # deeper at the front for the fascia
FOOT_IN, FOOT_H = 0.2, 0.09
RAIL_H, RAIL_W = 0.12, 0.16
RAIL_Z = AZ / 2 + 0.36                              # strike rail centre (front)
RAIL_X = AX / 2 + 0.36                              # maturity rail centre (right)
POST_X, POST_Z, POST_H = -(AX / 2 + 0.36), -(AZ / 2 + 0.36), 1.6
VIT_W, VIT_D, VIT_H, VIT_T = AX + 0.34, AZ + 0.34, 1.62, 0.018
FAS_Y, FAS_H, FAS_T = (PL_Y0 + PL_Y1) / 2, 0.44, 0.02
DIAL_X = (-2.45, -1.55, -0.65)
DIAL_R, KNOB_R, KNOB_L = 0.19, 0.13, 0.13
PIN_ROD_R, PIN_HEAD_R, PIN_HEAD_H, PIN_LEN = 0.019, 0.05, 0.03, 1.0

sc = lib.setup(samples=48)


# ---- materials ----------------------------------------------------------------------------------------------
def img(path, data=False):
    im = bpy.data.images.load(path)
    if data:
        im.colorspace_settings.name = 'Non-Color'
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


def shrink(im, n):
    if im.size[0] > n:
        im.scale(n, n)
    return im


W = os.path.join(SRC, 'polyhaven-dark-wood')
M9 = os.path.join(SRC, 'ambientcg-metal009')
M51 = os.path.join(SRC, 'ambientcg-metal051a')
walnut = pbr('walnut', rough=0.55,
             col=img(f'{W}/dark_wood_diff_1k.jpg'), rmap=img(f'{W}/dark_wood_rough_1k.jpg', True), nmap=img(f'{W}/dark_wood_nor_gl_1k.jpg', True), nstrength=0.6)
alu = pbr('aluminium', base=(0.91, 0.92, 0.92), metal=1.0, rough=0.32,
          col=shrink(img(f'{M9}/Metal009_1K-JPG_Color.jpg'), 512), rmap=shrink(img(f'{M9}/Metal009_1K-JPG_Roughness.jpg', True), 512),
          nmap=shrink(img(f'{M9}/Metal009_1K-JPG_NormalGL.jpg', True), 512), nstrength=0.5)
dialface = pbr('dialface', base=(0.9, 0.9, 0.9), metal=1.0, rough=0.3,
               col=shrink(img(f'{M51}/Metal051A_1K-JPG_Color.jpg'), 512), rmap=shrink(img(f'{M51}/Metal051A_1K-JPG_Roughness.jpg', True), 512),
               nmap=shrink(img(f'{M51}/Metal051A_1K-JPG_NormalGL.jpg', True), 512), nstrength=0.7)
brass = pbr('brass', base=(0.91, 0.70, 0.38), metal=1.0, rough=0.26)
foot = pbr('foot', base=(0.02, 0.018, 0.017), rough=0.6)
glass = pbr('glass', base=(1, 1, 1), rough=0.03)


def assign(ob, m):
    ob.data.materials.clear()
    ob.data.materials.append(m)
    return ob


parts = []

# ---- walnut plinth: a slab with a softened top edge, on a recessed black foot (the shadow gap) ----
bm = bmesh.new()
lib.add_box(bm, (0, (PL_Y0 + PL_Y1) / 2, (PL_Z0 + PL_Z1) / 2), (PL_W, PL_Y1 - PL_Y0, PL_Z1 - PL_Z0), bevel=0.035, seg=3)
parts.append(assign(lib.part('plinth', bm, dense=0.32, uv=(2.6, 2.6)), walnut))
bm = bmesh.new()
lib.add_box(bm, (0, PL_Y0 - FOOT_H / 2, (PL_Z0 + PL_Z1) / 2), (PL_W - 2 * FOOT_IN, FOOT_H, PL_Z1 - PL_Z0 - 2 * FOOT_IN), bevel=0.01, seg=2)
parts.append(assign(lib.part('foot', bm, dense=0.5), foot))

# ---- the brushed deck the pins pass through (the holes are a decal on the site, drawn at the exact pin pitch) ----
bm = bmesh.new()
lib.add_box(bm, (0, -DECK_T / 2, 0), (DECK_W, DECK_T, DECK_D), bevel=0.012, seg=2)
parts.append(assign(lib.part('deck', bm, dense=0.3, uv=(1.6, 1.6)), alu))

# ---- rails (strike along the front, maturity along the right) and the implied-vol post at the back left ----
bm = bmesh.new()
lib.add_box(bm, (0, RAIL_H / 2, RAIL_Z), (AX + 0.42, RAIL_H, RAIL_W), bevel=0.018, seg=3)
parts.append(assign(lib.part('rail_strike', bm, dense=0.25, uv=(1.6, 1.6)), alu))
bm = bmesh.new()
lib.add_box(bm, (RAIL_X, RAIL_H / 2, 0), (RAIL_W, RAIL_H, AZ + 0.42), bevel=0.018, seg=3)
parts.append(assign(lib.part('rail_maturity', bm, dense=0.25, uv=(1.6, 1.6)), alu))
bm = bmesh.new()
lib.add_box(bm, (POST_X, POST_H / 2, POST_Z), (0.12, POST_H, 0.12), bevel=0.014, seg=3)
lib.add_box(bm, (POST_X, 0.03, POST_Z), (0.26, 0.06, 0.26), bevel=0.012, seg=2)      # its foot block
parts.append(assign(lib.part('post_vol', bm, dense=0.25, uv=(1.6, 1.6)), alu))

# ---- front fascia with three dial faces and knurled brass knobs ----
FZ = PL_Z1
bm = bmesh.new()
lib.add_box(bm, (0, FAS_Y, FZ + FAS_T / 2), (PL_W - 0.5, FAS_H, FAS_T), bevel=0.006, seg=2)
parts.append(assign(lib.part('fascia', bm, dense=0.3, uv=(1.6, 1.6)), alu))
DY = FAS_Y + 0.025
for i, x in enumerate(DIAL_X):
    bm = bmesh.new()
    lib.add_cyl(bm, (x, DY, FZ + FAS_T + 0.006), DIAL_R, 0.012, axis='z', segs=64, bevel=0.004)
    ob = assign(lib.part(f'dialface_{i}', bm, dense=0.2), dialface)
    # circular brushing needs polar uvs: u, v = the face position mapped into the unit square
    me = ob.data
    uvl = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            sx, sy = co.x - x, co.z - DY
            uvl.data[li].uv = (0.5 + sx / (2 * DIAL_R) * 0.98, 0.5 + sy / (2 * DIAL_R) * 0.98)
    parts.append(ob)

KNOB_NAMES = ('knob_theta', 'knob_rho', 'knob_eta')
for i, x in enumerate(DIAL_X):
    bm = bmesh.new()
    z0 = FZ + FAS_T + 0.012
    # knurled skirt: 72 ridges, built as rings of alternating radius around the z axis (local, centred on the knob axis)
    segs, rings = 96, [(0.0, KNOB_R * 0.97), (0.012, KNOB_R), (KNOB_L - 0.03, KNOB_R), (KNOB_L - 0.012, KNOB_R * 0.9)]
    rows = []
    for (h, r) in rings:
        row = []
        for j in range(segs):
            a = math.tau * j / segs
            rr = r * (0.965 if (j % 2 and 0.005 < h < KNOB_L - 0.02) else 1.0)
            row.append(bm.verts.new(S(math.cos(a) * rr, math.sin(a) * rr, h)))
        rows.append(row)
    for A, B in zip(rows, rows[1:]):
        for j in range(segs):
            j2 = (j + 1) % segs
            bm.faces.new((A[j], A[j2], B[j2], B[j]))
    # domed polished cap
    capc = bm.verts.new(S(0, 0, KNOB_L))
    last = rows[-1]
    mid = [bm.verts.new(S(math.cos(math.tau * j / segs) * KNOB_R * 0.72, math.sin(math.tau * j / segs) * KNOB_R * 0.72, KNOB_L - 0.002)) for j in range(segs)]
    for j in range(segs):
        j2 = (j + 1) % segs
        bm.faces.new((last[j], last[j2], mid[j2], mid[j]))
        bm.faces.new((mid[j], mid[j2], capc))
    base = bm.verts.new(S(0, 0, 0.0))
    first = rows[0]
    for j in range(segs):
        j2 = (j + 1) % segs
        bm.faces.new((first[j2], first[j], base))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    ob = lib.part(KNOB_NAMES[i], bm, dense=0.0, smooth_angle=0.9, local=True)
    ob.location = S(x, DY, z0)
    parts.append(assign(ob, brass))

# ---- the vitrine: five thin panes with eased edges (one mesh) ----
bm = bmesh.new()
hw, hd = VIT_W / 2, VIT_D / 2
lib.add_box(bm, (0, VIT_H - VIT_T / 2, 0), (VIT_W, VIT_T, VIT_D), bevel=0.005, seg=2)
lib.add_box(bm, (0, (VIT_H - VIT_T) / 2, hd - VIT_T / 2), (VIT_W, VIT_H - VIT_T, VIT_T), bevel=0.005, seg=2)
lib.add_box(bm, (0, (VIT_H - VIT_T) / 2, -hd + VIT_T / 2), (VIT_W, VIT_H - VIT_T, VIT_T), bevel=0.005, seg=2)
lib.add_box(bm, (hw - VIT_T / 2, (VIT_H - VIT_T) / 2, 0), (VIT_T, VIT_H - VIT_T, VIT_D - 2 * VIT_T), bevel=0.005, seg=2)
lib.add_box(bm, (-hw + VIT_T / 2, (VIT_H - VIT_T) / 2, 0), (VIT_T, VIT_H - VIT_T, VIT_D - 2 * VIT_T), bevel=0.005, seg=2)
vit = assign(lib.part('vitrine', bm, dense=0.0, smooth_angle=0.5), glass)

# ---- one pin: a rod (unit length below the head; the site stretches it to the deck) and a domed head ----
bm = bmesh.new()
hb = -PIN_HEAD_H
prof = [(0.0, hb - PIN_LEN), (PIN_ROD_R, hb - PIN_LEN), (PIN_ROD_R, hb - 0.002), (PIN_HEAD_R * 0.9, hb), (PIN_HEAD_R, hb + 0.006),
        (PIN_HEAD_R, hb + PIN_HEAD_H * 0.5)]
for k in range(1, 6):
    a = (k / 5) * math.pi / 2
    prof.append((PIN_HEAD_R * math.cos(a), hb + PIN_HEAD_H * 0.5 + PIN_HEAD_H * 0.5 * math.sin(a)))
prof[-1] = (0.0, 0.0)
lib.add_lathe(bm, prof, (0, 0, 0), axis='y', segs=14)
pin = assign(lib.part('pin', bm, dense=0.0, smooth_angle=1.2, local=True), brass)
pin.location = S(0, 0, 0)

# ---- bake: AO into COLOR_0 for the static body (the vitrine and the pin are not occluders: they move or are clear) ----
static = [o for o in parts]
lib.bake_ao(static, dist=0.45, gamma=1.0, floor=0.22, hide=(vit, pin), smooth=2)
for o in (vit, pin):
    me = o.data
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = 0
    buf = [1.0] * (len(me.vertices) * 4)
    ca.data.foreach_set('color', buf)

# ---- export: Draco geometry, WebP images ----
allp = parts + [vit, pin]
bpy.ops.object.select_all(action='DESELECT')
for o in allp:
    o.select_set(True)
bpy.context.view_layer.objects.active = allp[0]
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
for o in allp:
    print('PART', o.name, len(o.data.polygons), 'faces')

# ---- the studio HDRI at 512 x 256 (radiance .hdr) for the site's PMREM ----
if HDR_OUT:
    h = bpy.data.images.load(os.path.join(SRC, 'polyhaven-studio-small-09', 'studio_small_09_1k.hdr'))
    h.scale(512, 256)
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'HDR'
    h.save_render(HDR_OUT, scene=sc)
    print('HDR_OK', HDR_OUT, os.path.getsize(HDR_OUT))
