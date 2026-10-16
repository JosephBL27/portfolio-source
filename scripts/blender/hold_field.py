# The bouldering field around stop 23 "hold" (w23): a forest floor of Poly Haven CC0 scans standing on a Geometry Nodes terrain, lit by the SAME Poly Haven HDRI the site
# shows as its backdrop ("Forest Slope", Andreas Mischok: a sandstone bouldering forest), light BAKED in Cycles on Metal:
#   terrain   Geometry Nodes grid (2R x 2R), two noise octaves of relief that die away inside the landing zone, cut to a disc; the bake writes LIGHT ONLY (irradiance) into a
#             planar lightmap (u = x/(2R)+0.5, v = y/(2R)+0.5, Blender axes); the site tiles Poly Haven "Forest Ground 04" over it and multiplies
#   rocks     Poly Haven "Rock Moss Set 01" (6 scanned rocks, decimated), scattered with Geometry Nodes by slope, distance and a clumping noise, light baked into a float vertex colour
#   ferns     Poly Haven "Fern 02" (4 variants), scattered the same way in denser clumps, light baked into a float vertex colour
#   canopy    an invisible noise-cut plane high above that only casts shadows: the sun reaches the floor in dapples, as on the photograph's own floor (never exported)
#   occluders the hero boulder (public/models/glb/namaqualand-boulder-03.glb, placed as cabinet/boulder.ts places it) and the two crash pads (PADS, the same numbers as
#             spaces/hold-field.ts) shadow the floor in the bake; never exported
# Colour (display-referred, the site writes material output straight to the canvas): every baked value is L = curve(a * E) / srgb(a) / GAIN, a = the mean albedo of the asset's
# own texture times the baked irradiance, curve = the repo's hue-preserving shoulder + sRGB (scripts/hdri-prep.mjs). The site multiplies the raw texture by L * GAIN, which is
# the display value of albedo x light up to the shoulder (srgb(a.b) ~ srgb(a).srgb(b)).
#   Blender -b --factory-startup -P scripts/blender/hold_field.py -- <polyhaven cache> <hdri .exr/.hdr> <hero.glb> <out dir> [--spp=128] [--expo=1] [--rot=-45] [--lm=2048] [--nocanopy] [--skycheck]
# Shipped run (w23): --spp=128 --lm=1024 with the 2k .hdr (short runs: longer headless Blender runs were being terminated on this machine). Outputs in <out dir>: hold-field.glb (terrain + rocks + ferns, Draco + WebP), field-light.png (grey: the SHADOW RATIO of the inserts on the floor, baked with / baked bare), hold-field.json (counts, timings), skycheck.png.
# Site axes (x right, y up, z toward the arriving camera) map to Blender (x, -z, y): the dwell camera stands at (0, -13.1, 3.3), the boulder at the origin, "ahead" is +Y.
# Joseph's M5 preset (scripts/blender/m5_preset.py, lookdev) is applied strictly (no inline copy, no CPU fallback: a missing Metal device raises); the bake overrides only the sample count (bakes take no adaptive sampling / denoise).
import bpy, bmesh, sys, os, math, time, json
from mathutils import Vector, Matrix
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
PH, HDRI, HERO, OUT = argv[0], argv[1], argv[2], argv[3]
opt = {a.split('=')[0]: (a.split('=')[1] if '=' in a else True) for a in argv[4:] if a.startswith('--')}
SPP = int(opt.get('--spp', 128)); EXPO = float(opt.get('--expo', 1.0)); ROT = float(opt.get('--rot', -30)); LM = int(opt.get('--lm', 2048))
R = 22.0; RMAX = 16.5; GRID = 121; GAIN = 2.0; SEED = int(opt.get('--seed', 7))
# crash pads in the STAGE's frame (site axes; the stage group stands 0.1 rad off the space): centre x, y, z, size x, y, z, yaw. Same numbers in spaces/hold-field.ts
PADS = [(-0.85, 0.06, 3.9, 1.5, 0.12, 1.2, 0.32), (0.62, 0.055, 4.75, 1.3, 0.11, 1.05, -0.26)]
STAGE_YAW = 0.1
os.makedirs(OUT, exist_ok=True)
T0 = time.time()
def log(*a): print('FIELD', round(time.time() - T0, 1), *a, flush=True)

sys.dont_write_bytecode = True   # Blender ignores PYTHONDONTWRITEBYTECODE; keeps __pycache__ out of the repo
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
# The preset is not optional: an earlier inline copy of its values had no Metal check, so a missing device became a silent CPU render.
M5_DIR = opt.get('--m5') or os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(os.path.join(M5_DIR, 'm5_preset.py')):
    raise FileNotFoundError(f'm5_preset.py not found in {M5_DIR} (pass --m5=<dir>); display_curve.py is imported from the same directory')
sys.path.insert(0, M5_DIR)
import m5_preset
m5_preset.apply_prefs(quiet=True)      # strict: raises when no Metal device is usable. read_factory_settings above drops the saved prefs, so this re-asserts Metal + M5 GPU + MetalRT Auto
preset = m5_preset.apply(scene, 'lookdev'); log('m5 preset from', M5_DIR)
scene.cycles.samples = SPP
import display_curve   # next to m5_preset.py (M5_DIR is on sys.path); the one tone curve, no pasted copy

def S(x, y, z): return Vector((x, -z, y))

# --------------------------------------------------------------------------------------------------------------------- assets
def append(blend, prefix):
    with bpy.data.libraries.load(blend, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n.startswith(prefix)]
    return [o for o in dst.objects if o is not None and o.type == 'MESH']

def prep_proto(ob, coll, target=None, sink=0.0):
    coll.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    ob.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if target and len(ob.data.polygons) > target:
        m = ob.modifiers.new('dec', 'DECIMATE'); m.ratio = target / len(ob.data.polygons); bpy.ops.object.modifier_apply(modifier='dec')
    co = np.empty(len(ob.data.vertices) * 3, np.float32); ob.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    mn, mx = co.min(0), co.max(0)
    ob.data.transform(Matrix.Translation((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2] - sink * (mx[2] - mn[2]))))
    ob.location = (0, 0, 0); ob.hide_render = True
    return len(ob.data.polygons), [round(float(v), 2) for v in (mx - mn)]

protos = bpy.data.collections.new('protos'); scene.collection.children.link(protos)
rock_c = bpy.data.collections.new('rocks'); fern_c = bpy.data.collections.new('ferns')
protos.children.link(rock_c); protos.children.link(fern_c)
rocks = append(os.path.join(PH, 'rock_moss_set_01', 'rock_moss_set_01_2k.blend'), 'rock_moss_set_01_rock')
ferns = append(os.path.join(PH, 'fern_02', 'fern_02_2k.blend'), 'fern_02_')
info = {'rocks': [], 'ferns': []}
for o in rocks: info['rocks'].append((o.name,) + prep_proto(o, rock_c, 2600, 0.2))
for o in ferns: info['ferns'].append((o.name,) + prep_proto(o, fern_c, None, 0.02))
log('protos', info)

# --------------------------------------------------------------------------------------------------------------------- Geometry Nodes helpers
class G:
    def __init__(self, name):
        self.ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
        self.ng.interface.new_socket(name='Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
        self.out = self.ng.nodes.new('NodeGroupOutput')
    def n(self, t, **props):
        nd = self.ng.nodes.new(t)
        for k, v in props.items():
            if hasattr(nd, k): setattr(nd, k, v)
            else: nd.inputs[k].default_value = v
        return nd
    def l(self, a, b): self.ng.links.new(a, b)
    def math(self, op, a, b=None):
        m = self.n('ShaderNodeMath', operation=op)
        for i, v in enumerate((a, b)):
            if v is None: continue
            if isinstance(v, (int, float)): m.inputs[i].default_value = v
            else: self.l(v, m.inputs[i])
        return m.outputs[0]
    def mapr(self, v, a, b, c, d, smooth=True):
        m = self.n('ShaderNodeMapRange'); m.interpolation_type = 'SMOOTHSTEP' if smooth else 'LINEAR'; m.clamp = True
        self.l(v, m.inputs['Value']); m.inputs['From Min'].default_value = a; m.inputs['From Max'].default_value = b; m.inputs['To Min'].default_value = c; m.inputs['To Max'].default_value = d
        return m.outputs['Result']
    def noise(self, vec, scale, detail=3.0, rough=0.5):
        t = self.n('ShaderNodeTexNoise'); self.l(vec, t.inputs['Vector']); t.inputs['Scale'].default_value = scale; t.inputs['Detail'].default_value = detail; t.inputs['Roughness'].default_value = rough
        return t.outputs['Fac']
    def radius(self):
        p = self.n('GeometryNodeInputPosition'); sep = self.n('ShaderNodeSeparateXYZ'); self.l(p.outputs[0], sep.inputs[0])
        c = self.n('ShaderNodeCombineXYZ'); self.l(sep.outputs[0], c.inputs[0]); self.l(sep.outputs[1], c.inputs[1])
        ln = self.n('ShaderNodeVectorMath', operation='LENGTH'); self.l(c.outputs[0], ln.inputs[0])
        return p.outputs[0], sep, ln.outputs['Value']

def gn_object(name, g):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    mod = ob.modifiers.new('gn', 'NODES'); mod.node_group = g.ng
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier='gn')
    return ob

# ---- terrain
g = G('terrain')
grid = g.n('GeometryNodeMeshGrid'); grid.inputs['Size X'].default_value = 2 * R; grid.inputs['Size Y'].default_value = 2 * R
grid.inputs['Vertices X'].default_value = GRID; grid.inputs['Vertices Y'].default_value = GRID
uvs = g.n('GeometryNodeStoreNamedAttribute', data_type='FLOAT2', domain='CORNER'); uvs.inputs['Name'].default_value = 'lmg'
g.l(grid.outputs['Mesh'], uvs.inputs['Geometry']); g.l(grid.outputs['UV Map'], uvs.inputs['Value'])
pos, sep, r = g.radius()
far = g.mapr(r, 4.6, 12.0, 0.0, 1.0); near = g.mapr(r, 2.4, 5.5, 0.25, 1.0)
h1 = g.math('MULTIPLY', g.math('SUBTRACT', g.noise(pos, 0.045, 4.0, 0.55), 0.5), 0.5)      # gentle: the photograph projected on it assumes a level floor
h2 = g.math('MULTIPLY', g.math('SUBTRACT', g.noise(pos, 0.55, 2.0, 0.5), 0.5), 0.14)
h = g.math('ADD', g.math('MULTIPLY', h1, far), g.math('MULTIPLY', h2, near))
off = g.n('ShaderNodeCombineXYZ'); g.l(h, off.inputs[2])
sp = g.n('GeometryNodeSetPosition'); g.l(uvs.outputs['Geometry'], sp.inputs['Geometry']); g.l(off.outputs[0], sp.inputs['Offset'])
dl = g.n('GeometryNodeDeleteGeometry', domain='POINT'); g.l(sp.outputs['Geometry'], dl.inputs['Geometry']); g.l(g.math('GREATER_THAN', r, R + 0.3), dl.inputs['Selection'])
g.l(dl.outputs['Geometry'], g.out.inputs[0])
terrain = gn_object('terrain', g)
log('terrain', len(terrain.data.polygons), 'faces', [a.name for a in terrain.data.uv_layers])

# ---- scatter: rocks and ferns on the terrain
def scatter(name, coll, dmin, dens, rmin, clump, clump_lo, scale_lo, scale_hi, tilt, seed, slope_w):
    g = G(name)
    oi = g.n('GeometryNodeObjectInfo', transform_space='RELATIVE'); oi.inputs['Object'].default_value = terrain
    ds = g.n('GeometryNodeDistributePointsOnFaces', distribute_method='POISSON'); g.l(oi.outputs['Geometry'], ds.inputs['Mesh'])
    ds.inputs['Distance Min'].default_value = dmin; ds.inputs['Density Max'].default_value = dens; ds.inputs['Seed'].default_value = seed
    pos, sep, r = g.radius()
    # density: outside the landing zone, out of the camera's corridor (y < 0 between the camera and the boulder), clumped by a noise, more on slopes
    ring = g.mapr(r, rmin, rmin + 2.5, 0.0, 1.0)
    ax = g.math('ABSOLUTE', sep.outputs[0])
    corridor = g.math('MULTIPLY', g.mapr(ax, 2.2, 4.8, 1.0, 0.0), g.mapr(sep.outputs[1], -2.0, -4.0, 0.0, 1.0))
    keep = g.math('SUBTRACT', 1.0, corridor)
    cl = g.mapr(g.noise(pos, clump, 2.0, 0.5), clump_lo, clump_lo + 0.12, 0.0, 1.0)
    nrm = g.n('GeometryNodeInputNormal'); ns = g.n('ShaderNodeSeparateXYZ'); g.l(nrm.outputs[0], ns.inputs[0])
    slope = g.mapr(ns.outputs[2], 0.995, 0.93, 1.0 - slope_w, 1.0, smooth=False)
    edge = g.mapr(r, RMAX - 2.5, RMAX, 1.0, 0.0)
    # and near the eye only: far inserts stand where the photograph shows trunks, not floor, and read as floating
    ex = g.math('SUBTRACT', sep.outputs[0], 0.0); ey = g.math('ADD', sep.outputs[1], 13.1)
    de = g.math('SQRT', g.math('ADD', g.math('MULTIPLY', ex, ex), g.math('MULTIPLY', ey, ey)))
    edge = g.math('MULTIPLY', edge, g.mapr(de, 24.0, 27.0, 1.0, 0.0))
    f = g.math('MULTIPLY', g.math('MULTIPLY', g.math('MULTIPLY', ring, keep), g.math('MULTIPLY', cl, slope)), edge)
    g.l(f, ds.inputs['Density Factor'])
    ci = g.n('GeometryNodeCollectionInfo'); ci.inputs['Collection'].default_value = coll; ci.inputs['Separate Children'].default_value = True; ci.inputs['Reset Children'].default_value = True
    wn = g.n('ShaderNodeTexWhiteNoise', noise_dimensions='3D'); pp = g.n('GeometryNodeInputPosition'); g.l(pp.outputs[0], wn.inputs['Vector'])
    wc = g.n('ShaderNodeSeparateXYZ'); g.l(wn.outputs['Color'], wc.inputs[0])
    idx = g.math('FLOOR', g.math('MULTIPLY', wn.outputs['Value'], len(coll.objects) - 0.001))
    eul = g.n('ShaderNodeCombineXYZ')
    g.l(g.math('MULTIPLY', g.math('SUBTRACT', wc.outputs[0], 0.5), tilt), eul.inputs[0]); g.l(g.math('MULTIPLY', g.math('SUBTRACT', wc.outputs[1], 0.5), tilt), eul.inputs[1])
    g.l(g.math('MULTIPLY', wc.outputs[2], 6.2832), eul.inputs[2])
    e2r = g.n('FunctionNodeEulerToRotation'); g.l(eul.outputs[0], e2r.inputs[0])
    scl = g.math('ADD', scale_lo, g.math('MULTIPLY', g.math('FRACT', g.math('MULTIPLY', wn.outputs['Value'], 7.31)), scale_hi - scale_lo))
    io = g.n('GeometryNodeInstanceOnPoints'); g.l(ds.outputs['Points'], io.inputs['Points']); g.l(ci.outputs[0], io.inputs['Instance'])
    io.inputs['Pick Instance'].default_value = True; g.l(idx, io.inputs['Instance Index']); g.l(e2r.outputs[0], io.inputs['Rotation']); g.l(scl, io.inputs['Scale'])
    rl = g.n('GeometryNodeRealizeInstances'); g.l(io.outputs['Instances'], rl.inputs['Geometry'])
    g.l(rl.outputs['Geometry'], g.out.inputs[0])
    return gn_object(name, g)

rock_o = scatter('rocks', rock_c, 2.3, 0.34, 5.6, 0.11, 0.42, 0.42, 1.0, 0.35, SEED, 0.6)
fern_o = scatter('ferns', fern_c, 0.95, 1.15, 4.4, 0.19, 0.5, 0.75, 1.45, 0.25, SEED + 11, 0.2)
log('rocks', len(rock_o.data.polygons), 'faces; ferns', len(fern_o.data.polygons), 'faces')
for o in list(rock_c.objects) + list(fern_c.objects): o.hide_render = True

# --------------------------------------------------------------------------------------------------------------------- occluders: hero boulder, pads, canopy
occ = []
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=HERO)
hb = [o for o in bpy.data.objects if o not in before and o.type == 'MESH'][0]; hb.parent = None
hb.matrix_world = Matrix.Identity(4); bpy.context.view_layer.objects.active = hb; bpy.ops.object.select_all(action='DESELECT'); hb.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
co = np.empty(len(hb.data.vertices) * 3, np.float32); hb.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3); mn, mx = co.min(0), co.max(0)
sc = 3.3 / (mx[2] - mn[2]); hb.data.transform(Matrix.Translation((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2])))
hb.matrix_world = Matrix.Rotation(0.5 + STAGE_YAW, 4, 'Z') @ Matrix.Diagonal((sc, sc, sc, 1)); hb.name = 'occ-boulder'; occ.append(hb)
hbm = bpy.data.materials.new('sandstone'); hbm.use_nodes = True; hbm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.34, 0.26, 0.19, 1)
hb.data.materials.clear(); hb.data.materials.append(hbm)
padm = bpy.data.materials.new('pad'); padm.use_nodes = True; padm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.03, 0.04, 0.07, 1)
for i, (x, y, z, sx, sy, sz, yaw) in enumerate(PADS):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); me = bpy.data.meshes.new(f'pad{i}'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f'occ-pad{i}', me); scene.collection.objects.link(ob); me.materials.append(padm)
    c = Matrix.Rotation(STAGE_YAW, 4, 'Z') @ S(x, y, z)
    ob.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(STAGE_YAW + yaw, 4, 'Z') @ Matrix.Diagonal((sx, sz, sy, 1)); occ.append(ob)
if '--canopy' in opt:      # off by default: the photograph already carries its own dappled light; the plate is multiplied by a shadow RATIO only
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=45); me = bpy.data.meshes.new('canopy'); bm.to_mesh(me); bm.free()
    can = bpy.data.objects.new('occ-canopy', me); scene.collection.objects.link(can); can.location = (0, 0, 17)
    cm = bpy.data.materials.new('canopy'); nt = cm.node_tree; nt.nodes.clear()
    o_ = nt.nodes.new('ShaderNodeOutputMaterial'); mix = nt.nodes.new('ShaderNodeMixShader'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); df = nt.nodes.new('ShaderNodeBsdfDiffuse')
    df.inputs['Color'].default_value = (0.05, 0.07, 0.03, 1)
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.23; nz.inputs['Detail'].default_value = 6; nz.inputs['Roughness'].default_value = 0.62
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = 0.47; ramp.color_ramp.elements[1].position = 0.53
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(df.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], o_.inputs['Surface'])
    me.materials.append(cm)
    can.visible_camera = False; can.visible_glossy = False; can.visible_transmission = False; can.visible_diffuse = False
    occ.append(can)

# world: the backdrop HDRI, turned so that az 0 (ahead, +Y) shows HDRI yaw YAWC (the site's hold.ts), ROT = -(90 + YAWC)
world = bpy.data.worlds.new('forest'); scene.world = world; nt = world.node_tree; nt.nodes.clear()
tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); env = nt.nodes.new('ShaderNodeTexEnvironment'); bg = nt.nodes.new('ShaderNodeBackground'); wo = nt.nodes.new('ShaderNodeOutputWorld')
env.image = bpy.data.images.load(HDRI); mp.inputs['Rotation'].default_value[2] = math.radians(ROT)
nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector']); nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs[0], wo.inputs['Surface'])
try: world.cycles.sampling_method = 'MANUAL'; world.cycles.sample_map_resolution = 2048
except Exception as e: log('world sampling', e)

# --------------------------------------------------------------------------------------------------------------------- colour
srgb = display_curve.srgb_oetf
curve = display_curve.shoulder_srgb      # hue-preserving shoulder (knee 0.8, scripts/hdri-prep.mjs) then sRGB
def mean_albedo(img_path):
    im = bpy.data.images.load(img_path); im.scale(64, 64); px = np.empty(64 * 64 * 4, np.float32); im.pixels.foreach_get(px)
    a = px.reshape(-1, 4)[:, :3]; ok = px.reshape(-1, 4)[:, 3] > 0.5
    m = a[ok].mean(0) if ok.any() else a.mean(0); bpy.data.images.remove(im)
    return m           # linear (Blender decodes the sRGB jpg)
def to_display(irr, alb):
    """irr: (..., 3) baked irradiance; alb: linear mean albedo -> L = curve(alb*irr*E) / srgb(alb) / GAIN"""
    return np.clip(curve(irr * alb * EXPO) / np.maximum(srgb(alb), 1e-3) / GAIN, 0, 1)

GROUND_TEX = os.path.join(PH, 'forest_ground_04', 'forest_ground_04_diff_2k.jpg')
a_ground = mean_albedo(GROUND_TEX)
rock_img = [n.image for m in rock_o.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and 'diff' in n.image.name][0]
fern_img = [n.image for m in fern_o.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and 'diff' in n.image.name][0]
fern_alpha = [n.image for m in fern_o.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and 'alpha' in n.image.name]
a_rock = mean_albedo(bpy.path.abspath(rock_img.filepath)); a_fern = mean_albedo(bpy.path.abspath(fern_img.filepath))
log('albedo', a_ground.round(3), a_rock.round(3), a_fern.round(3))

# terrain bake material: a diffuse with the ground's mean albedo (so the bounce light is the right colour)
tm = bpy.data.materials.new('terrain-bake'); nt = tm.node_tree; nt.nodes.clear()
o_ = nt.nodes.new('ShaderNodeOutputMaterial'); bs = nt.nodes.new('ShaderNodeBsdfDiffuse'); bs.inputs['Color'].default_value = (*a_ground, 1); nt.links.new(bs.outputs[0], o_.inputs['Surface'])
terrain.data.materials.clear(); terrain.data.materials.append(tm)

# --------------------------------------------------------------------------------------------------------------------- bake: lightmap + vertex light
for o in protos.all_objects: o.hide_render = True
t = time.time()
gim = bpy.data.images.new('field-light', LM, LM, alpha=False, float_buffer=True); gim.colorspace_settings.name = 'Non-Color'
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = gim; tn.select = True; nt.nodes.active = tn
terrain.data.uv_layers.active = terrain.data.uv_layers['lmg']
bpy.ops.object.select_all(action='DESELECT'); terrain.select_set(True); bpy.context.view_layer.objects.active = terrain
lum = lambda a: a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
def bake_terrain():
    bpy.ops.object.select_all(action='DESELECT'); terrain.select_set(True); bpy.context.view_layer.objects.active = terrain
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6, margin_type='EXTEND', use_clear=True)
    px = np.empty(LM * LM * 4, np.float32); gim.pixels.foreach_get(px); irr = px.reshape(LM, LM, 4)[:, :, :3].copy()
    k = np.exp(-0.5 * (np.arange(-3, 4) / 1.2) ** 2); k /= k.sum()       # a light gaussian (sigma ~1.2 px): the bake's grain, not its shadows
    for ax in (0, 1): irr = sum(np.roll(irr, s, axis=ax) * w for s, w in zip(range(-3, 4), k))
    return irr
# the photograph's sun is partly clipped / leaf-filtered in the HDRI, so the bake adds the sun as a lamp from the same direction (the HDRI peak: yaw 41, elevation 40),
# scaled so the sunlit floor gets SUNK x the sky light: the inserts then cast a real shadow on the plate (the site's key light comes from the same direction)
inserts = [o for o in occ if o.name != 'occ-canopy'] + [rock_o, fern_o]
for o in inserts: o.hide_render = True
irr_sky = bake_terrain()
c0 = LM // 2; K = float(lum(irr_sky[c0 - LM // 5:c0 + LM // 5, c0 - LM // 5:c0 + LM // 5]).mean())
for o in inserts: o.hide_render = False
SUN_AZ, SUN_EL = math.radians(41 - (-90 - ROT)), math.radians(40)          # az from ahead toward +x: HDRI yaw - YAWC, YAWC = -(90 + ROT)
d3 = Vector((math.sin(SUN_AZ) * math.cos(SUN_EL), math.sin(SUN_EL), -math.cos(SUN_AZ) * math.cos(SUN_EL)))     # site axes
dB = Vector((d3.x, -d3.z, d3.y)).normalized()
SUNK = float(opt.get('--sunk', 1.5)); sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = SUNK * K / math.sin(SUN_EL); sun.angle = math.radians(2.0); sun.color = (1.0, 0.95, 0.88)
so = bpy.data.objects.new('sun', sun); scene.collection.objects.link(so); so.rotation_euler = dB.to_track_quat('Z', 'Y').to_euler()
log('sky irradiance', round(K, 4), 'sun strength', round(sun.energy, 3), 'dir (site)', [round(v, 3) for v in d3]); t = time.time()
irr_w = bake_terrain()                                   # with everything that stands on the floor
log('bake terrain (with inserts)', round(time.time() - t, 1), 's', SPP, 'spp', LM, 'px'); t = time.time()
for o in inserts: o.hide_render = True
irr_0 = bake_terrain()                                   # the bare floor: what the photograph already shows
for o in inserts: o.hide_render = False
log('bake terrain (bare)', round(time.time() - t, 1), 's')
ratio = np.clip(lum(irr_w) / np.maximum(lum(irr_0), 1e-4), 0, 1)
L = to_display(irr_w, a_ground)
oim = bpy.data.images.new('field-light-out', LM, LM, alpha=False, float_buffer=False); oim.colorspace_settings.name = 'Non-Color'
o4 = np.ones((LM, LM, 4), np.float32); o4[:, :, :3] = ratio[..., None]; oim.pixels.foreach_set(o4.reshape(-1)); oim.filepath_raw = os.path.join(OUT, 'field-light.png'); oim.file_format = 'PNG'; oim.save()
log('lightmap mean', L.mean((0, 1)).round(3), 'p95', np.percentile(L[:, :, 1], 95).round(3), 'ratio p1/p50', np.percentile(ratio, 1).round(3), np.percentile(ratio, 50).round(3))

def bake_vertex(ob, alb):
    me = ob.data
    for a in list(me.color_attributes): me.color_attributes.remove(a)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ca; me.color_attributes.render_color_index = 0
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    t = time.time(); bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, target='VERTEX_COLORS')
    n = len(me.vertices); buf = np.empty(n * 4, np.float32); ca.data.foreach_get('color', buf); irr = buf.reshape(-1, 4)[:, :3]
    Lv = to_display(irr, alb); o = np.ones((n, 4), np.float32); o[:, :3] = Lv; ca.data.foreach_set('color', o.reshape(-1)); me.update()
    log('bake', ob.name, n, 'verts', round(time.time() - t, 1), 's mean', Lv.mean(0).round(3))
bake_vertex(rock_o, a_rock)
fm = bpy.data.materials.new('fern-bake'); nt2 = fm.node_tree; nt2.nodes.clear()
o2 = nt2.nodes.new('ShaderNodeOutputMaterial'); mx2 = nt2.nodes.new('ShaderNodeMixShader'); tr2 = nt2.nodes.new('ShaderNodeBsdfTransparent'); df2 = nt2.nodes.new('ShaderNodeBsdfDiffuse'); df2.inputs['Color'].default_value = (*a_fern, 1)
if fern_alpha:
    ta = nt2.nodes.new('ShaderNodeTexImage'); ta.image = fern_alpha[0]; ta.image.colorspace_settings.name = 'Non-Color'; nt2.links.new(ta.outputs['Color'], mx2.inputs['Fac'])
else: mx2.inputs['Fac'].default_value = 1.0
nt2.links.new(tr2.outputs[0], mx2.inputs[1]); nt2.links.new(df2.outputs[0], mx2.inputs[2]); nt2.links.new(mx2.outputs[0], o2.inputs['Surface'])
fern_mats = list(fern_o.data.materials); fern_o.data.materials.clear(); fern_o.data.materials.append(fm)
for q in fern_o.data.polygons: q.material_index = 0
bake_vertex(fern_o, a_fern)
fern_o.data.materials.clear()
for m_ in fern_mats: fern_o.data.materials.append(m_)

# --------------------------------------------------------------------------------------------------------------------- export: terrain (lightmap uv only), rocks + ferns (uv, light colour, their diffuse map)
def unlit_mat(name, img, alpha_img=None, size=1024):
    im = img.copy(); im.name = name + '-map'; im.scale(size, size)
    if alpha_img is not None:
        al = alpha_img.copy(); al.scale(size, size); a = np.empty(size * size * 4, np.float32); al.pixels.foreach_get(a)
        p = np.empty(size * size * 4, np.float32); im.pixels.foreach_get(p); p = p.reshape(-1, 4); p[:, 3] = a.reshape(-1, 4)[:, 0]
        im2 = bpy.data.images.new(name + '-rgba', size, size, alpha=True); im2.pixels.foreach_set(p.reshape(-1)); im = im2
        im.alpha_mode = 'STRAIGHT'
    m = bpy.data.materials.new(name); mt = m.node_tree; mt.nodes.clear()
    o_ = mt.nodes.new('ShaderNodeOutputMaterial'); b_ = mt.nodes.new('ShaderNodeBsdfPrincipled'); t_ = mt.nodes.new('ShaderNodeTexImage'); t_.image = im
    mt.links.new(t_.outputs['Color'], b_.inputs['Base Color']); mt.links.new(b_.outputs[0], o_.inputs['Surface'])
    if alpha_img is not None: mt.links.new(t_.outputs['Alpha'], b_.inputs['Alpha'])
    return m
for ob, m in ((rock_o, unlit_mat('field-rock', rock_img)), (fern_o, unlit_mat('field-fern', fern_img, fern_alpha[0] if fern_alpha else None))):
    ob.data.materials.clear(); ob.data.materials.append(m)
    for q in ob.data.polygons: q.material_index = 0
    for u in [u for u in ob.data.uv_layers if u != ob.data.uv_layers[0]]: ob.data.uv_layers.remove(u)
tmx = bpy.data.materials.new('field-ground'); terrain.data.materials.clear(); terrain.data.materials.append(tmx)
for u in [u for u in terrain.data.uv_layers if u.name != 'lmg']: terrain.data.uv_layers.remove(u)
bpy.ops.object.select_all(action='DESELECT')
for ob in (terrain, rock_o, fern_o): ob.select_set(True)
bpy.context.view_layer.objects.active = terrain
glb = os.path.join(OUT, 'hold-field.glb')
kw = dict(filepath=glb, export_format='GLB', use_selection=True, export_image_format='WEBP', export_image_quality=80,
          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7, export_draco_position_quantization=14, export_draco_normal_quantization=10,
          export_draco_texcoord_quantization=12, export_draco_color_quantization=10, export_normals=False, export_yup=True, export_cameras=False, export_lights=False, export_apply=False)
try: bpy.ops.export_scene.gltf(export_vertex_color='ACTIVE', **kw)
except TypeError: bpy.ops.export_scene.gltf(**kw)
log('glb', glb, os.path.getsize(glb))
json.dump({'sun': {'K': K, 'strength': sun.energy, 'dir_site': list(d3), 'sunk': SUNK}, 'protos': info, 'faces': {'terrain': len(terrain.data.polygons), 'rocks': len(rock_o.data.polygons), 'ferns': len(fern_o.data.polygons)},
           'expo': EXPO, 'spp': SPP, 'rot': ROT, 'lm': LM, 'gain': GAIN, 'R': R, 'albedo': {'ground': a_ground.tolist(), 'rock': a_rock.tolist(), 'fern': a_fern.tolist()},
           'pads': PADS, 'preset': preset, 'seconds': round(time.time() - T0, 1)}, open(os.path.join(OUT, 'hold-field.json'), 'w'), indent=1, default=str)

if '--skycheck' in opt:      # the world alone from the dwell camera, Standard view: compare with the site's backdrop at the same yaw
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = True
    scene.view_settings.view_transform = 'Standard'; scene.cycles.samples = 8; scene.cycles.use_denoising = False
    cam = bpy.data.cameras.new('c'); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(44)
    co_ = bpy.data.objects.new('c', cam); scene.collection.objects.link(co_); scene.camera = co_
    co_.location = (0, -13.1, 3.3); co_.rotation_euler = (Vector((0, 0, 2.75)) - Vector((0, -13.1, 3.3))).to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_x, scene.render.resolution_y = 960, 600; scene.render.resolution_percentage = 100; scene.render.filepath = os.path.join(OUT, 'skycheck.png')
    bpy.ops.render.render(write_still=True)
log('done')
