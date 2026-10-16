"""M5 proof project: small alpine terrain + Geometry Nodes scatter of the shared Poly Haven cache, rendered headless.

  /usr/bin/time -l Blender -b --python scripts/blender/m5_proof_alpine.py -- --out out/proof --mode lookdev [--percent 100]

Terrain: A.N.T. Landscape extension (bl_ext.blender_org.antlandscape), reshaped to a valley.
Terrain material: forest_ground_04 + rocky_terrain (2K, box projection, rock on slopes).
Scatter (one Geometry Nodes group on the terrain): fir_tree_01 LOD1 near the camera and LOD2 farther away, pine_sapling_medium
LOD2, fern_02 (4 variants), rock_moss_set_01 (6 variants). Light: forest_slope 4K EXR. Preset: m5_preset.py.
Only LOD1/LOD2/card collections are appended; the multi-million-triangle LOD0 trees are never loaded.
"""
import json
import math
import os
import sys
import time
import importlib.util

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True   # Blender ignores PYTHONDONTWRITEBYTECODE; load_preset() below would write __pycache__ into the repo
HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.expanduser('~/AgentRuntime/assets/polyhaven')


def parse():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--out', default=os.path.join(HERE, '..', '..', 'out', 'proof'))
    p.add_argument('--mode', default='lookdev')
    p.add_argument('--percent', type=int)
    p.add_argument('--samples', type=int)
    p.add_argument('--res', default='2560x1440')
    p.add_argument('--no-render', action='store_true')
    p.add_argument('--name', default='alpine')
    p.add_argument('--seed', type=int, default=7)
    return p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


A = parse()
OUT = os.path.abspath(A.out)
os.makedirs(OUT, exist_ok=True)
T0 = time.time()
LOG = {'blender': bpy.app.version_string, 'args': vars(A), 'steps': {}}


def step(name, t):
    LOG['steps'][name] = round(time.time() - t, 2)


def load_preset():
    spec = importlib.util.spec_from_file_location('m5_preset', os.path.join(HERE, 'm5_preset.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------- scene reset
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for c in list(bpy.data.collections):
    bpy.data.collections.remove(c)
sc = bpy.context.scene
sc.name = 'm5_proof_' + A.name
rw, rh = (int(v) for v in A.res.split('x'))
sc.render.resolution_x, sc.render.resolution_y = rw, rh
m5 = load_preset()
LOG['prefs'] = m5.apply_prefs(quiet=True)


# ---------------------------------------------------------------- helpers
def S(node, name, out=False):
    socks = node.outputs if out else node.inputs
    for s in socks:
        if s.name == name and s.enabled:
            return s
    raise KeyError(f'{node.bl_idname}: no enabled {"output" if out else "input"} {name!r}; have {[s.name for s in socks if s.enabled]}')


def append_collection(slug, res, coll, new_name):
    """Append one collection from <slug>_<res>.blend, repoint relative image paths, keep it OUT of the scene."""
    d = os.path.join(R, slug)
    f = os.path.join(d, f'{slug}_{res}.blend')
    before = set(bpy.data.images.keys())
    with bpy.data.libraries.load(f, link=False) as (src, dst):
        dst.collections = [coll]
    c = bpy.data.collections[coll]
    c.name = new_name
    for img in bpy.data.images:
        if img.name in before or img.packed_file or not img.filepath:
            continue
        if img.filepath.startswith('//'):
            img.filepath = os.path.normpath(os.path.join(d, img.filepath[2:]))
    return c


def tris(coll):
    n = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for o in coll.all_objects:
        if o.type == 'MESH':
            e = o.evaluated_get(dg)
            m = e.to_mesh()
            n += sum(len(p.vertices) - 2 for p in m.polygons)
            e.to_mesh_clear()
    return n


# ---------------------------------------------------------------- assets
t = time.time()
LOD1 = append_collection('fir_tree_01', '1k', 'fir_tree_01_LOD1', 'src_fir_LOD1')
LOD2 = append_collection('fir_tree_01', '1k', 'fir_tree_01_LOD2', 'src_fir_LOD2')
SAP = append_collection('pine_sapling_medium', '1k', 'pine_sapling_medium_LOD2', 'src_sapling_LOD2')
FERN = append_collection('fern_02', '2k', 'fern_02', 'src_fern')
ROCK = append_collection('rock_moss_set_01', '2k', 'rock_moss_set_01', 'src_rocks')
# Collection Info (Separate Children) turns each object of a collection into one pickable variant:
# fir LOD1/LOD2 = 3 tree variants (a, b, c), sapling = 3, fern = 4, rocks = 6.
PARENTS = {'fir_near': LOD1, 'fir_far': LOD2, 'sapling': SAP, 'fern': FERN, 'rocks': ROCK}
LOG['source_tris'] = {k: tris(v) for k, v in {'fir_LOD1': LOD1, 'fir_LOD2': LOD2, 'sapling_LOD2': SAP, 'fern': FERN, 'rocks': ROCK}.items()}
step('append_assets', t)

# ---------------------------------------------------------------- terrain (A.N.T. Landscape extension)
t = time.time()
import addon_utils  # noqa: E402
ok = addon_utils.check('bl_ext.blender_org.antlandscape')
if not (ok[0] and ok[1]):
    bpy.ops.preferences.addon_enable(module='bl_ext.blender_org.antlandscape')
LOG['ant_enabled'] = list(addon_utils.check('bl_ext.blender_org.antlandscape'))
SIZE = 80.0
bpy.ops.mesh.landscape_add(
    ant_terrain_name='Terrain', at_cursor=True, smooth_mesh=True, tri_face=False, sphere_mesh=False,
    subdivision_x=224, subdivision_y=224, mesh_size_x=SIZE, mesh_size_y=SIZE, mesh_size=SIZE,
    random_seed=A.seed, noise_type='hetero_terrain', basis_type='PERLIN_ORIGINAL', noise_depth=9,
    noise_size_x=34.0, noise_size_y=34.0, noise_size_z=1.0, noise_size=34.0,
    dimension=1.0, lacunarity=2.0, offset=0.8, distortion=1.0, height=5.5, height_invert=False,
    edge_falloff='0', edge_level=0.0, remove_double=False, refresh=True, auto_refresh=True)
terrain = bpy.data.objects['Terrain']
terrain.location = (0, 0, 0)
# valley: lift the back (+y) into a hillside, flatten a path toward the camera
me = terrain.data
for v in me.vertices:
    y = (v.co.y + SIZE / 2) / SIZE  # 0 front .. 1 back
    v.co.z = v.co.z * (0.45 + 0.9 * y) + 11.0 * (y ** 2.2) - 0.8
me.update()
zs = [v.co.z for v in me.vertices]
LOG['terrain'] = {'verts': len(me.vertices), 'faces': len(me.polygons), 'z_min': round(min(zs), 2), 'z_max': round(max(zs), 2), 'size_m': SIZE}
step('terrain_ant', t)

# ---------------------------------------------------------------- terrain material
t = time.time()
mat = bpy.data.materials.new('terrain_forest_rock')
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()


def img_node(path, noncolor=False, tile=0.22, x=0, y=0, proj='BOX'):
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = bpy.data.images.load(path, check_existing=True)
    if noncolor:
        n.image.colorspace_settings.name = 'Non-Color'
    n.projection = proj
    n.projection_blend = 0.25
    n.location = (x, y)
    return n


def pf(slug, tag, res='2k'):
    return os.path.join(R, slug, f'{slug}_{tag}_{res}.jpg')


coord = nt.nodes.new('ShaderNodeTexCoord')
mapping = nt.nodes.new('ShaderNodeMapping')
mapping.inputs['Scale'].default_value = (0.2, 0.2, 0.2)
nt.links.new(coord.outputs['Object'], mapping.inputs['Vector'])
tex = {}
for key, slug in (('f', 'forest_ground_04'), ('r', 'rocky_terrain')):
    tex[key + 'd'] = img_node(pf(slug, 'diff'))
    tex[key + 'a'] = img_node(pf(slug, 'arm'), True)
    tex[key + 'h'] = img_node(pf(slug, 'disp'), True)
    for n in (tex[key + 'd'], tex[key + 'a'], tex[key + 'h']):
        nt.links.new(mapping.outputs['Vector'], n.inputs['Vector'])
geo = nt.nodes.new('ShaderNodeNewGeometry')
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
nt.links.new(geo.outputs['Normal'], sep.inputs['Vector'])
rng = nt.nodes.new('ShaderNodeMapRange')  # world-normal Z: steep -> 1 (rock), flat -> 0 (forest floor)
rng.inputs['From Min'].default_value = 0.88
rng.inputs['From Max'].default_value = 0.66
rng.inputs['To Min'].default_value = 0.0
rng.inputs['To Max'].default_value = 1.0
rng.clamp = True
nt.links.new(sep.outputs['Z'], rng.inputs['Value'])


def mix(a, b, kind='RGBA', label=''):
    if kind == 'RGBA':
        m = nt.nodes.new('ShaderNodeMix')
        m.data_type = 'RGBA'
        nt.links.new(rng.outputs['Result'], m.inputs['Factor'])
        nt.links.new(a, m.inputs['A'])
        nt.links.new(b, m.inputs['B'])
        return m.outputs['Result']
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'FLOAT'
    nt.links.new(rng.outputs['Result'], m.inputs['Factor'])
    nt.links.new(a, m.inputs['A'])
    nt.links.new(b, m.inputs['B'])
    return m.outputs['Result']


color = mix(tex['fd'].outputs['Color'], tex['rd'].outputs['Color'])
sa_f = nt.nodes.new('ShaderNodeSeparateColor')
sa_r = nt.nodes.new('ShaderNodeSeparateColor')
nt.links.new(tex['fa'].outputs['Color'], sa_f.inputs['Color'])
nt.links.new(tex['ra'].outputs['Color'], sa_r.inputs['Color'])
rough = mix(sa_f.outputs['Green'], sa_r.outputs['Green'], 'FLOAT')
ao = mix(sa_f.outputs['Red'], sa_r.outputs['Red'], 'FLOAT')
height = mix(tex['fh'].outputs['Color'], tex['rh'].outputs['Color'], 'FLOAT')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
mulao = nt.nodes.new('ShaderNodeMix')
mulao.data_type = 'RGBA'
mulao.blend_type = 'MULTIPLY'
mulao.inputs['Factor'].default_value = 1.0
nt.links.new(color, mulao.inputs['A'])
ao_col = nt.nodes.new('ShaderNodeCombineColor')
for ch in ('Red', 'Green', 'Blue'):
    nt.links.new(ao, ao_col.inputs[ch])
nt.links.new(ao_col.outputs['Color'], mulao.inputs['B'])
nt.links.new(mulao.outputs['Result'], bsdf.inputs['Base Color'])
nt.links.new(rough, bsdf.inputs['Roughness'])
bump = nt.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 0.55
bump.inputs['Distance'].default_value = 0.06
nt.links.new(height, bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
out = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
terrain.data.materials.clear()
terrain.data.materials.append(mat)
step('terrain_material', t)

# ---------------------------------------------------------------- camera + light + world
t = time.time()
cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 30
cam_data.sensor_width = 36
cam_data.clip_end = 400
cam = bpy.data.objects.new('cam', cam_data)
sc.collection.objects.link(cam)
cam.location = (-4.0, -46.0, 3.0)
look = Vector((3.0, 10.0, 7.5))
cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam
bpy.context.view_layer.update()

world = bpy.data.worlds.new('forest_slope_4k')
world.use_nodes = True
wn = world.node_tree
wn.nodes.clear()
tc = wn.nodes.new('ShaderNodeTexCoord')
mp = wn.nodes.new('ShaderNodeMapping')
mp.inputs['Rotation'].default_value = (0, 0, math.radians(35))
env = wn.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(os.path.join(R, 'forest_slope', 'forest_slope_4k.exr'), check_existing=True)
bg = wn.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = 1.0
wo = wn.nodes.new('ShaderNodeOutputWorld')
wn.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
wn.links.new(mp.outputs['Vector'], env.inputs['Vector'])
wn.links.new(env.outputs['Color'], bg.inputs['Color'])
wn.links.new(bg.outputs['Background'], wo.inputs['Surface'])
sc.world = world
sc.view_settings.exposure = 0.6
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 4.0
sun.data.angle = math.radians(1.2)
sun.rotation_euler = (math.radians(52), math.radians(8), math.radians(-38))
sc.collection.objects.link(sun)
sc.collection.objects.link(terrain) if terrain.name not in sc.collection.objects else None
step('camera_world', t)

# ---------------------------------------------------------------- Geometry Nodes scatter
t = time.time()
ng = bpy.data.node_groups.new('ScatterAlpine', 'GeometryNodeTree')
ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
N = ng.nodes
L = ng.links
gin = N.new('NodeGroupInput')
gout = N.new('NodeGroupOutput')
join = N.new('GeometryNodeJoinGeometry')
L.new(gin.outputs[0], join.inputs[0])
normal = N.new('GeometryNodeInputNormal')
nsep = N.new('ShaderNodeSeparateXYZ')
L.new(normal.outputs['Normal'], nsep.inputs['Vector'])
pos = N.new('GeometryNodeInputPosition')
camobj = N.new('GeometryNodeObjectInfo')
camobj.transform_space = 'ORIGINAL'
S(camobj, 'Object').default_value = cam
dist = N.new('ShaderNodeVectorMath')
dist.operation = 'DISTANCE'
L.new(pos.outputs['Position'], dist.inputs[0])
L.new(camobj.outputs['Location'], dist.inputs[1])


def cmp(a_out, b_val, op):
    c = N.new('FunctionNodeCompare')
    c.data_type = 'FLOAT'
    c.operation = op
    L.new(a_out, S(c, 'A'))
    S(c, 'B').default_value = b_val
    return c.outputs['Result']


def AND(a, b):
    n = N.new('FunctionNodeBooleanMath')
    n.operation = 'AND'
    L.new(a, n.inputs[0])
    L.new(b, n.inputs[1])
    return n.outputs['Boolean']


def rnd(kind, lo, hi, seed, vec=False):
    r = N.new('FunctionNodeRandomValue')
    r.data_type = 'FLOAT_VECTOR' if vec else kind
    S(r, 'Min').default_value = lo
    S(r, 'Max').default_value = hi
    S(r, 'Seed').default_value = seed
    return r.outputs['Value']


COUNTS = {}


def layer(label, key, method, density, dmin, seed, slope_min, d_lo, d_hi, scale, tilt=0.0, variants=1, lift=0.0):
    d = N.new('GeometryNodeDistributePointsOnFaces')
    d.distribute_method = method
    L.new(gin.outputs[0], d.inputs['Mesh'])
    S(d, 'Seed').default_value = seed
    if method == 'POISSON':
        S(d, 'Distance Min').default_value = dmin
        S(d, 'Density Max').default_value = density
        S(d, 'Density Factor').default_value = 1.0
    else:
        S(d, 'Density').default_value = density
    sel = cmp(nsep.outputs['Z'], slope_min, 'GREATER_THAN')
    sel = AND(sel, cmp(dist.outputs['Value'], d_lo, 'GREATER_EQUAL'))
    sel = AND(sel, cmp(dist.outputs['Value'], d_hi, 'LESS_THAN'))
    L.new(sel, S(d, 'Selection'))
    ci = N.new('GeometryNodeCollectionInfo')
    ci.transform_space = 'RELATIVE'
    S(ci, 'Collection').default_value = PARENTS[key]
    S(ci, 'Separate Children').default_value = True
    S(ci, 'Reset Children').default_value = True
    iop = N.new('GeometryNodeInstanceOnPoints')
    L.new(d.outputs['Points'], iop.inputs['Points'])
    L.new(ci.outputs['Instances'], S(iop, 'Instance'))
    S(iop, 'Pick Instance').default_value = True
    if variants > 1:
        L.new(rnd('INT', 0, variants - 1, seed + 3), S(iop, 'Instance Index'))
    rot = N.new('FunctionNodeRandomValue')
    rot.data_type = 'FLOAT_VECTOR'
    S(rot, 'Min').default_value = (-tilt, -tilt, 0.0)
    S(rot, 'Max').default_value = (tilt, tilt, math.tau)
    S(rot, 'Seed').default_value = seed + 5
    L.new(rot.outputs['Value'], S(iop, 'Rotation'))
    sc_f = rnd('FLOAT', scale[0], scale[1], seed + 7)
    comb = N.new('ShaderNodeCombineXYZ')
    for k in ('X', 'Y', 'Z'):
        L.new(sc_f, comb.inputs[k])
    L.new(comb.outputs['Vector'], S(iop, 'Scale'))
    if lift:
        tr = N.new('GeometryNodeTranslateInstances')
        L.new(iop.outputs['Instances'], S(tr, 'Instances'))
        S(tr, 'Translation').default_value = (0, 0, lift)
        out_sock = tr.outputs['Instances']
    else:
        out_sock = iop.outputs['Instances']
    L.new(out_sock, join.inputs[0])
    COUNTS[label] = key


# camera sits 6 m in front of the terrain edge: clearing (ferns, rocks) first, firs from 15 m, LOD2 beyond 42 m
layer('fir_near', 'fir_near', 'POISSON', 0.020, 8.0, 11, 0.86, 15.0, 42.0, (0.85, 1.2), tilt=0.02, variants=3)
layer('fir_far', 'fir_far', 'POISSON', 0.022, 7.0, 21, 0.84, 42.0, 400.0, (0.9, 1.35), tilt=0.02, variants=3)
layer('sapling', 'sapling', 'POISSON', 0.030, 4.0, 31, 0.88, 11.0, 400.0, (0.8, 1.3), tilt=0.04, variants=3)
layer('ferns', 'fern', 'RANDOM', 0.55, 0.0, 41, 0.90, 5.0, 60.0, (0.8, 1.5), tilt=0.12, variants=4)
layer('rocks', 'rocks', 'RANDOM', 0.045, 0.0, 51, 0.55, 5.0, 400.0, (0.4, 1.3), tilt=0.5, variants=6, lift=-0.04)
L.new(join.outputs['Geometry'], gout.inputs[0])
mod = terrain.modifiers.new('ScatterAlpine', 'NODES')
mod.node_group = ng
step('geometry_nodes_build', t)

# ---------------------------------------------------------------- preset, then evaluate once to count instances
LOG['preset'] = m5.apply(sc, A.mode, samples=A.samples, percent=A.percent)
t = time.time()
dg = bpy.context.evaluated_depsgraph_get()
dg.update()
ev = terrain.evaluated_get(dg)
inst = sum(1 for i in dg.object_instances if i.is_instance)
LOG['instances_evaluated'] = inst
LOG['terrain_eval_tris'] = tris_n = sum(len(p.vertices) - 2 for p in ev.to_mesh().polygons)
step('depsgraph_eval', t)

blend_path = os.path.join(OUT, f'{A.name}_{A.mode}.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_path, compress=True)
LOG['blend'] = blend_path
LOG['blend_bytes'] = os.path.getsize(blend_path)

# ---------------------------------------------------------------- render
if not A.no_render:
    pct = sc.render.resolution_percentage
    png = os.path.join(OUT, f'{A.name}_{A.mode}_{rw}x{rh}_{pct}pct.png')
    sc.render.filepath = png
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.color_depth = '8'
    t = time.time()
    bpy.ops.render.render(write_still=True)
    LOG['render_seconds'] = round(time.time() - t, 2)
    LOG['png'] = png
    LOG['png_px'] = [int(rw * pct / 100), int(rh * pct / 100)]
    LOG['png_bytes'] = os.path.getsize(png) if os.path.exists(png) else None
LOG['total_seconds'] = round(time.time() - T0, 2)
json.dump(LOG, open(os.path.join(OUT, f'{A.name}_{A.mode}_log.json'), 'w'), indent=1, default=str)
print('PROOF_JSON ' + json.dumps(LOG, default=str))
