# The bouldering crag ring (stop 23 "hold"): a 360 degree ring of Poly Haven CC0 photoscans (Namaqualand set, the same sandstone as the hero boulder) standing around
# the boulder, lit by the same Poly Haven dusk HDRI as the backdrop (+ one warm key matching the space's key spot), light BAKED in Cycles (Metal) into one display-referred
# image per piece (in the scan's own UV layout: smart-projected lightmap UVs of decimated photoscans shatter into one island per face and bake black), exported as ONE
# Draco + WebP GLB (one mesh per piece, unlit at runtime: MeshBasicMaterial, 0 lights). The ground is NOT in the GLB: the site builds a disc and tiles the
# ambientCG CC0 ground over a baked lightmap (written here as ground-light.webp, display-referred like the atlases, planar UV: u = x/(2R)+0.5, v = y/(2R)+0.5).
#   Blender -b --factory-startup -P scripts/blender/crag_ring.py -- <assets-src dir> <out dir> [--expo=0.7] [--spp=48] [--texscale=1] [--key=3.0] [--rot=-138] [--cpu] [--noprev] [--skycheck]
#   the shipped files came from: --texscale=1 --spp=48 --expo=0.7 (Metal on an M5 under load: 260 s; the six steps are timed in the log). Outputs in <out dir>: crag-ring.glb, ground-light.png,
#   tex-<piece>.png, prev-*.png (the unlit result from the site camera at yaw 0 / 180 / +-70). Then: cwebp -q 86 ground-light.png -o public/media/crag/ground-light.webp;
#   cp crag-ring.glb public/models/glb/. The HDRI rotation was checked with --skycheck against the site's backdrop (hill left, village bottom left, road to the right).
# <assets-src>: ph/<id>_<res>/<id>_<res>.gltf (Poly Haven models), hdri/kiara_9_dusk_2k.hdr, acg/Ground111_1K/*.jpg   (each download in its own directory, read as data only)
# Space-local axes of the site (x right, y up, z toward the arriving camera) map to Blender (x, -z, y): the camera stands at (0, -13.1, 3.3), the boulder at the origin,
# "ahead" is +Y. The colour step is the repo's: a hue-preserving peak-channel shoulder (knee 0.8, scripts/hdri-prep.mjs) then sRGB, so a baked image is display-referred.
import bpy, bmesh, sys, os, math, time, json
from mathutils import Vector, Matrix
import numpy as np

sys.dont_write_bytecode = True   # Blender ignores PYTHONDONTWRITEBYTECODE; keeps __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import display_curve, m5_preset      # the one tone curve and Joseph's M5 device / tile / cache values

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
opt = {a.split('=')[0]: (a.split('=')[1] if '=' in a else True) for a in argv[2:] if a.startswith('--')}
EXPO = float(opt.get('--expo', 0.7)); SPP = int(opt.get('--spp', 48)); TEXSCALE = float(opt.get('--texscale', 1)); ROT = float(opt.get('--rot', -138))
KEY_STRENGTH = float(opt.get('--key', 3.0))
GROUND_R = 40.0; LM = 1024
os.makedirs(OUT, exist_ok=True)
T0 = time.time()
def log(*a): print('CRAG', round(time.time() - T0, 1), *a, flush=True)

# --------------------------------------------------------------------------------------------------------------------- the pieces
# id, source, tex = baked image size (px), phi = bearing from "ahead" (+Y) toward +X (deg), rho = radius from the boulder (m),
# scale, tris, face (turn the scanned face to the centre; boulders are whole objects and just get a yaw), sink (m below the ground), yaw offset (deg)
PIECES = [
    dict(n='wall',   id='namaqualand_cliff_02_2k',   tex=2048, phi=22,   rho=24,  s=1.35, tris=80000, face=True,  sink=0.3),
    dict(n='crag_l', id='namaqualand_cliff_01_2k',   tex=1024, phi=-54,  rho=21,  s=1.6,  tris=40000, face=True,  sink=0.3),
    dict(n='massif', id='mountainside_1k',           tex=1024, phi=64,   rho=27,  s=1.2,  tris=40000, face=True,  sink=0.4),
    dict(n='b4_mid', id='namaqualand_boulder_04_1k', tex=1024, phi=-30,  rho=8.5, s=1.5,  tris=25000, face=False, sink=0.15, yaw=40),
    dict(n='b2_mid', id='namaqualand_boulder_02_1k', tex=512,  phi=38,   rho=7.5, s=1.4,  tris=12000, face=False, sink=0.1,  yaw=-20),
    dict(n='b5_back',id='namaqualand_boulder_05_1k', tex=512,  phi=-10,  rho=4.6, s=1.6,  tris=8000,  face=False, sink=0.05, yaw=15),
    dict(n='b5_fr',  id='namaqualand_boulder_05_1k', tex=512,  phi=150,  rho=7.0, s=1.3,  tris=8000,  face=False, sink=0.05, yaw=-70),
    dict(n='crag_r', id='namaqualand_cliff_02_2k',   tex=1024, phi=-120, rho=24,  s=1.2,  tris=40000, face=True,  sink=0.3),
    dict(n='crag_b', id='namaqualand_cliff_01_2k',   tex=1024, phi=128,  rho=22,  s=1.4,  tris=35000, face=True,  sink=0.3),
    dict(n='massif2',id='mountainside_1k',           tex=1024, phi=180,  rho=30,  s=1.1,  tris=30000, face=True,  sink=0.4),
    dict(n='b4_l',   id='namaqualand_boulder_04_1k', tex=512,  phi=-95,  rho=13,  s=1.3,  tris=15000, face=False, sink=0.15, yaw=200),
    dict(n='b2_r',   id='namaqualand_boulder_02_1k', tex=512,  phi=98,   rho=12,  s=1.2,  tris=8000,  face=False, sink=0.1,  yaw=75),
    dict(n='b5_b',   id='namaqualand_boulder_05_1k', tex=256,  phi=168,  rho=11,  s=1.5,  tris=6000,  face=False, sink=0.05, yaw=-30),
]
# the hero boulder (already on the site, public/models/glb/namaqualand-boulder-03.glb) is added only as an occluder for the bake (not exported)
KEY_DIR_THREE = Vector((8.6, -3.4, -7.2))   # space.light keyPos -> keyAim of spaces/hold.ts, three axes

# --------------------------------------------------------------------------------------------------------------------- helpers
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def three_to_blender(v): return Vector((v.x, -v.z, v.y))

def import_piece(p):
    d = os.path.join(SRC, 'ph', p['id']); gl = [f for f in os.listdir(d) if f.endswith('.gltf')][0]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(d, gl))
    meshes = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    for o in [o for o in bpy.data.objects if o not in before and o.type != 'MESH']: bpy.data.objects.remove(o)
    ob = meshes[0]
    for o in meshes[1:]: bpy.data.objects.remove(o)
    ob.parent = None; ob.matrix_world = Matrix.Identity(4)
    return ob

def facing_xy(ob):
    me = ob.data; me.calc_loop_triangles(); n = Vector((0, 0, 0))
    for t in me.loop_triangles:
        if abs(t.normal.z) < 0.85: n += Vector((t.normal.x, t.normal.y, 0)) * t.area      # side faces only: the top of a scan says nothing about where it looks
    return n.normalized() if n.length > 1e-6 else Vector((0, -1, 0))

def place(ob, p):
    me = ob.data
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    cx, cy, zmin = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
    f = facing_xy(ob) if p['face'] else None
    me.transform(Matrix.Translation((-cx, -cy, -zmin)))
    phi = math.radians(p['phi']); pos = Vector((p['rho'] * math.sin(phi), p['rho'] * math.cos(phi), -p['sink']))
    if p['face']:
        to_c = Vector((-pos.x, -pos.y, 0)).normalized()
        yaw = math.atan2(to_c.y, to_c.x) - math.atan2(f.y, f.x)
    else:
        yaw = math.radians(p.get('yaw', 0))
    ob.matrix_world = Matrix.Translation(pos) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Diagonal((p['s'], p['s'], p['s'], 1))
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def decimate(ob, target):
    n = len(ob.data.polygons)
    if n <= target: return n
    m = ob.modifiers.new('dec', 'DECIMATE'); m.ratio = target / n
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier='dec')
    return len(ob.data.polygons)

# --------------------------------------------------------------------------------------------------------------------- scene: pieces
pieces = []; stats = []
for p in PIECES:
    ob = import_piece(p); ob.name = p['n']
    place(ob, p)
    n = decimate(ob, p['tris'])
    pieces.append((p, ob)); stats.append((p['n'], n, int(p['tex'] * TEXSCALE)))
    log('piece', p['n'], p['id'], 'tris', n)
bpy.ops.object.select_all(action='DESELECT')

# --------------------------------------------------------------------------------------------------------------------- scene: hero boulder (occluder), ground, light
hb_path = os.path.normpath(os.path.join(SRC, '..', '..', 'public', 'models', 'glb', 'namaqualand-boulder-03.glb'))      # <assets-src> = <repo>/out/assets-src
occluders = []
if os.path.exists(hb_path):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=hb_path)
    hb = [o for o in bpy.data.objects if o not in before and o.type == 'MESH'][0]
    hb.parent = None
    # the site stands it on the origin, 3.3 high, yawed 0.5 + 0.1 rad (positive about up in both axis conventions)
    hb.matrix_world = Matrix.Identity(4); bpy.context.view_layer.objects.active = hb; hb.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    zs = [v.co.z for v in hb.data.vertices]; xs = [v.co.x for v in hb.data.vertices]; ys = [v.co.y for v in hb.data.vertices]
    sc = 3.3 / (max(zs) - min(zs))
    hb.data.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs))))
    hb.matrix_world = Matrix.Rotation(0.6, 4, 'Z') @ Matrix.Diagonal((sc, sc, sc, 1))     # boulder.ts: rock yaw 0.5 + the stage's 0.1 off the space
    hb.name = 'hero-boulder-occluder'; occluders.append(hb); hb.select_set(False)
    log('hero occluder', len(hb.data.polygons))

# ground disc, planar uv
gme = bpy.data.meshes.new('ground'); bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, cap_tris=True, segments=96, radius=GROUND_R)
uvl = bm.loops.layers.uv.new('lmg')
for f in bm.faces:
    for l in f.loops: l[uvl].uv = (l.vert.co.x / (2 * GROUND_R) + 0.5, l.vert.co.y / (2 * GROUND_R) + 0.5)
bm.to_mesh(gme); bm.free()
ground = bpy.data.objects.new('ground', gme); scene.collection.objects.link(ground)
gmat = bpy.data.materials.new('ground-bake'); nt = gmat.node_tree; nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfDiffuse'); nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
# macro variation: broad value/hue drift (the tiled micro albedo at runtime carries the grain), dark toward the rim
tc = nt.nodes.new('ShaderNodeTexCoord'); nz1 = nt.nodes.new('ShaderNodeTexNoise'); nz2 = nt.nodes.new('ShaderNodeTexNoise')
nz1.inputs['Scale'].default_value = 0.09; nz1.inputs['Detail'].default_value = 3.0; nz2.inputs['Scale'].default_value = 0.6; nz2.inputs['Detail'].default_value = 2.0
nt.links.new(tc.outputs['Object'], nz1.inputs['Vector']); nt.links.new(tc.outputs['Object'], nz2.inputs['Vector'])
ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = (0.30, 0.20, 0.14, 1); ramp.color_ramp.elements[1].position = 0.65; ramp.color_ramp.elements[1].color = (0.70, 0.55, 0.40, 1)
nt.links.new(nz1.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bsdf.inputs['Color'])
gme.materials.append(gmat); occluders.append(ground)

# world: the dusk HDRI, turned so it sits behind the boulder exactly where the site's backdrop shows it (az 0 = ahead = +Y; HDRI yaw 48 at az 0)
world = bpy.data.worlds.new('dusk'); scene.world = world
nt = world.node_tree; nt.nodes.clear()
tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); env = nt.nodes.new('ShaderNodeTexEnvironment'); bg = nt.nodes.new('ShaderNodeBackground'); wo = nt.nodes.new('ShaderNodeOutputWorld')
env.image = bpy.data.images.load(os.path.join(SRC, 'hdri', 'kiara_9_dusk_2k.hdr')); mp.inputs['Rotation'].default_value[2] = math.radians(ROT)
nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector']); nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs[0], wo.inputs['Surface'])
bg.inputs['Strength'].default_value = 1.0
# the space's warm key (spaces/hold.ts light.keyPos -> keyAim), as a soft sun: same direction on the rock as on the hero boulder
sun = bpy.data.lights.new('key', 'SUN'); sun.energy = KEY_STRENGTH; sun.color = (1.0, 0.72, 0.45); sun.angle = math.radians(6)
so = bpy.data.objects.new('key', sun); scene.collection.objects.link(so)
d = three_to_blender(KEY_DIR_THREE).normalized(); so.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

# cycles on Metal (works headless on 5.2.2, 7 of 7 runs); --cpu forces the CPU. No silent fallback: a missing Metal device raises (m5_preset.configure_device).
# Bake values: the preset's tile / cache / persistent data, no adaptive, no denoise, Standard view, Blender's default bounces (the shipped bake used them).
m5_preset.apply_bake(scene, SPP, device='CPU' if '--cpu' in opt else None)

# --------------------------------------------------------------------------------------------------------------------- bake the rock atlases
def curve_to_display(px, expo):
    """px: float32 rgba array -> display-referred rgba (display_curve.shoulder_srgb: hue-preserving peak-channel shoulder, knee 0.8, scripts/hdri-prep.mjs, then sRGB)"""
    o = px.reshape(-1, 4).copy(); o[:, :3] = display_curve.shoulder_srgb(px.reshape(-1, 4)[:, :3], expo); o[:, 3] = 1.0
    return o.reshape(-1)

def save_display(img, path, expo):
    w, h = img.size; px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px)
    o = curve_to_display(px, expo)
    out_img = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=False); out_img.colorspace_settings.name = 'Non-Color'
    out_img.pixels.foreach_set(o); out_img.filepath_raw = path; out_img.file_format = 'PNG'; out_img.save()
    return out_img

piece_img = {}
for p, ob in pieces:
    sz = int(p['tex'] * TEXSCALE)
    im = bpy.data.images.new(f"bake-{p['n']}", sz, sz, alpha=False, float_buffer=True); im.colorspace_settings.name = 'Non-Color'; piece_img[p['n']] = im
    for m in ob.data.materials:
        nt = m.node_tree; tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = im; tn.select = True; nt.nodes.active = tn
for o in occluders: o.hide_render = False
bpy.ops.object.select_all(action='DESELECT')
for p, ob in pieces: ob.select_set(True)
bpy.context.view_layer.objects.active = pieces[0][1]
t = time.time()
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, margin=8, margin_type='EXTEND', use_clear=True)
log('bake pieces', round(time.time() - t, 1), 's', SPP, 'spp')
for p, ob in pieces:
    save_display(piece_img[p['n']], os.path.join(OUT, f"tex-{p['n']}.png"), EXPO)

# ground lightmap
gim = bpy.data.images.new('ground-light', LM, LM, alpha=False, float_buffer=True); gim.colorspace_settings.name = 'Non-Color'
gme.uv_layers.active = gme.uv_layers[0]
tn = gmat.node_tree.nodes.new('ShaderNodeTexImage'); tn.image = gim; tn.select = True; gmat.node_tree.nodes.active = tn
bpy.ops.object.select_all(action='DESELECT'); ground.select_set(True); bpy.context.view_layer.objects.active = ground
t = time.time()
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, margin=4, margin_type='EXTEND', use_clear=True)
log('bake ground', round(time.time() - t, 1), 's')
save_display(gim, os.path.join(OUT, 'ground-light.png'), EXPO)

# --------------------------------------------------------------------------------------------------------------------- export: one unlit material per piece, Draco + WebP
for p, ob in pieces:
    me = ob.data
    me.materials.clear()
    mat = bpy.data.materials.new(f"ring-{p['n']}"); mt = mat.node_tree; mt.nodes.clear()
    o_ = mt.nodes.new('ShaderNodeOutputMaterial'); b_ = mt.nodes.new('ShaderNodeBsdfPrincipled'); t_ = mt.nodes.new('ShaderNodeTexImage')
    t_.image = bpy.data.images.load(os.path.join(OUT, f"tex-{p['n']}.png")); t_.image.colorspace_settings.name = 'sRGB'
    mt.links.new(t_.outputs['Color'], b_.inputs['Base Color']); mt.links.new(b_.outputs[0], o_.inputs['Surface'])
    b_.inputs['Roughness'].default_value = 1.0
    me.materials.append(mat)
    for q in me.polygons: q.material_index = 0
bpy.ops.object.select_all(action='DESELECT')
for p, ob in pieces: ob.select_set(True)
glb = os.path.join(OUT, 'crag-ring.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_image_format='WEBP', export_image_quality=82,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7, export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
    export_normals=False, export_yup=True, export_cameras=False, export_lights=False, export_apply=False)
log('glb', glb, os.path.getsize(glb))
json.dump({'pieces': stats, 'expo': EXPO, 'spp': SPP, 'rot': ROT, 'key': KEY_STRENGTH, 'ground_r': GROUND_R, 'lm': LM,
           'tris': sum(len(ob.data.polygons) for _, ob in pieces), 'seconds': round(time.time() - T0, 1)}, open(os.path.join(OUT, 'crag-ring.json'), 'w'), indent=1)

# --------------------------------------------------------------------------------------------------------------------- previews: what the site will show (unlit atlases) from the site camera
def preview(path, cam_pos, cam_tgt, fov=44, res=(960, 600)):
    cam = bpy.data.cameras.new('c'); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(fov)
    co = bpy.data.objects.new('c', cam); scene.collection.objects.link(co); scene.camera = co
    co.location = cam_pos; co.rotation_euler = (Vector(cam_tgt) - Vector(cam_pos)).to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_x, scene.render.resolution_y = res; scene.render.filepath = path; scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
if '--skycheck' in opt:
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = True
    so.hide_render = True; scene.view_settings.view_transform = 'Standard'; scene.cycles.samples = 8
    preview(os.path.join(OUT, 'skycheck.png'), (0, -13.1, 3.3), (0, 0, 2.75))
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = False
    so.hide_render = False
if '--noprev' not in opt:
    for p, ob in pieces:
        mt = ob.data.materials[0].node_tree; t_ = [n for n in mt.nodes if n.type == 'TEX_IMAGE'][0]; e_ = mt.nodes.new('ShaderNodeEmission')
        t_.image.colorspace_settings.name = 'Non-Color'
        mt.links.new(t_.outputs['Color'], e_.inputs['Color']); mt.links.new(e_.outputs[0], mt.nodes['Material Output'].inputs['Surface'])
    gmat2 = bpy.data.materials.new('g2'); g2 = gmat2.node_tree; g2.nodes.clear(); go = g2.nodes.new('ShaderNodeOutputMaterial'); ge = g2.nodes.new('ShaderNodeEmission'); gt = g2.nodes.new('ShaderNodeTexImage')
    gt.image = bpy.data.images.load(os.path.join(OUT, 'ground-light.png')); gt.image.colorspace_settings.name = 'Non-Color'
    g2.links.new(gt.outputs['Color'], ge.inputs['Color']); g2.links.new(ge.outputs[0], go.inputs['Surface']); gme.materials.clear(); gme.materials.append(gmat2)
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.02, 0.03, 1)
    for n in list(scene.world.node_tree.links): scene.world.node_tree.links.remove(n)
    hb = bpy.data.objects.get('hero-boulder-occluder')
    if hb: hb.hide_render = True
    so.hide_render = True
    scene.view_settings.view_transform = 'Raw'; scene.cycles.samples = 16
    preview(os.path.join(OUT, 'prev-yaw0.png'), (0, -13.1, 3.3), (0, 0, 2.75))
    preview(os.path.join(OUT, 'prev-yaw180.png'), (0, -13.1, 3.3), (0, -30, 3.3))
    preview(os.path.join(OUT, 'prev-yawL70.png'), (0, -13.1, 3.3), (-30 * math.sin(math.radians(70)) , -13.1 + 30 * math.cos(math.radians(70)), 3.3))
    preview(os.path.join(OUT, 'prev-yawR70.png'), (0, -13.1, 3.3), (30 * math.sin(math.radians(70)), -13.1 + 30 * math.cos(math.radians(70)), 3.3))
log('done')
