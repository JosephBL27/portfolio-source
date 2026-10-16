# The granite of the climbing-wall space (w11 spaces, public/models/crag.glb). w12: TWO meshes in one GLB.
#   Blender -b -P scripts/blender/crag.py -- public/models/crag.glb [target_tris]
#   'backdrop'   a cliff mass behind and two buttresses beside it: the old crag, kept as the fallback (?noterrain=1, a failed terrain load)
#   'foreground' three boulders framing the base of the wall and a little scree: the only rock left when the Yosemite backdrop is up (dark silhouettes against the valley)
# Each is decimated to its share of the triangle budget and AO-baked against the whole scene (so the boulders sit in the cliff's occlusion in the fallback).
# Modelled as displaced icospheres (squared off toward a block, ridged cracks), joined, decimated to the triangle budget, AO baked with Cycles on
# Metal (works headless on 5.2.2; M5_DEVICE=cpu forces the CPU) into a float vertex-colour attribute and multiplied with a granite albedo (speckle, lichen, iron stain).
# Exported as a GLB with COLOR_0 and no textures / no Draco. Scene units are metres-ish; the site reads them as world units 1:1.
# Axes: Blender (X, Y, Z) = site (x, -z, y): the backdrop is at +Y, up is +Z. glTF export turns Z-up into Y-up.
import bpy, bmesh, sys, os, math, random
from mathutils import Vector, noise
sys.dont_write_bytecode = True   # Blender ignores PYTHONDONTWRITEBYTECODE; keeps __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m5_preset

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
TARGET = int(argv[1]) if len(argv) > 1 else 22000
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
m5_preset.apply_bake(sc, 24)   # Metal GPU via the M5 preset (read_factory_settings dropped the saved prefs); M5_DEVICE=cpu forces the CPU


def fbm(p, octaves=4, lac=2.03, gain=0.5):
    a, s, f = 1.0, 0.0, 1.0
    for _ in range(octaves):
        s += a * noise.noise(p * f)
        f *= lac
        a *= gain
    return s


def ridged(p, octaves=3):
    a, s, f = 1.0, 0.0, 1.0
    for _ in range(octaves):
        s += a * (1.0 - abs(noise.noise(p * f)))
        f *= 2.1
        a *= 0.5
    return s / 1.75


def planes_for(rng, extra=9):
    """a convex block: six jittered faces plus corner / edge cuts. (normal, distance) in rock units (the rock is 1 across)"""
    pl = []
    for axis in range(3):
        for sign in (-1, 1):
            n = Vector((0, 0, 0))
            n[axis] = sign
            n = (n + Vector((rng.uniform(-.2, .2), rng.uniform(-.2, .2), rng.uniform(-.2, .2)))).normalized()
            pl.append((n, rng.uniform(0.84, 1.0)))
    for _ in range(extra):
        n = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        pl.append((n, rng.uniform(0.80, 0.97)))
    return pl


def soft_radius(h, planes, k=11.0):
    """distance along unit direction h to the soft-min of the planes: a convex polytope with rounded edges"""
    ts = [(d / c) for (n, d) in planes for c in (n.dot(h),) if c > 0.03]
    m = min(ts)
    return m - math.log(sum(math.exp(-k * (t - m)) for t in ts)) / k


def rock(name, centre, half, seed, subdiv=5, square=0.5, rough=0.22, crack=0.2, flat_top=0.0):
    """a faceted granite block: a rounded convex polytope (soft-min of random planes), joint cracks along three sets, lumpy surface noise. half = (hx, hy, hz)."""
    rng = random.Random(seed * 101 + 7)
    planes = planes_for(rng, 6 + int(square * 10))
    joints = []
    for _ in range(3):
        n = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.35, 0.35) if len(joints) < 2 else rng.uniform(0.7, 1.0))).normalized()
        joints.append((n, rng.uniform(1.3, 2.1), rng.uniform(0, 1)))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    off = Vector((seed * 7.31, seed * 3.17, seed * 5.53))
    for v in bm.verts:
        h = v.co.normalized()
        r = soft_radius(h, planes)
        q = h * r
        P = Vector((q.x * half[0], q.y * half[1], q.z * half[2]))
        wob = fbm(P * 0.55 + off, 2)
        g = 0.0
        for (n, sp, ph) in joints:
            u = P.dot(n) / sp + ph + 0.4 * wob
            f = abs((u - math.floor(u)) - 0.5) * sp
            g = max(g, 1.0 - min(1.0, f / 0.2))
        d = rough * (0.55 * fbm(q * 2.6 + off, 3) + 0.2 * fbm(q * 7.0 + off, 2)) - crack * g * g
        if flat_top > 0 and q.z > 0.25:
            q.z = q.z * (1.0 - flat_top) + 0.25 * flat_top
        k = 1.0 + d
        v.co = Vector((q.x * k * half[0], q.y * k * half[1], q.z * k * half[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.location = Vector(centre)
    sc.collection.objects.link(ob)
    ob.rotation_euler = (0, 0, math.radians(random.uniform(-14, 14)))
    return ob


back_parts, front_parts = [], []
# the cliff mass behind, the two buttresses (the backdrop); three boulders in front (centre, half sizes: Blender axes)
back_parts.append(rock('cliff', (-1.7, 5.4, 3.5), (4.5, 2.0, 4.2), 1, subdiv=7, square=0.5, rough=0.20, crack=0.22, flat_top=0.35))
back_parts.append(rock('buttL', (-5.6, 2.6, 1.9), (1.9, 2.0, 2.1), 2, subdiv=6, square=0.5, rough=0.24, crack=0.2))
back_parts.append(rock('buttR', (5.7, 3.2, 1.5), (1.8, 1.9, 1.6), 3, subdiv=6, square=0.5, rough=0.24, crack=0.2))
front_parts.append(rock('boulderA', (-5.3, -1.0, 0.8), (1.25, 1.15, 0.85), 4, subdiv=6, square=0.35, rough=0.2, crack=0.14))
front_parts.append(rock('boulderB', (5.5, -1.5, 0.62), (1.0, 0.95, 0.65), 5, subdiv=6, square=0.35, rough=0.2, crack=0.14))
front_parts.append(rock('boulderC', (-3.0, 2.2, 0.45), (0.8, 0.7, 0.45), 6, subdiv=5, square=0.3, rough=0.2, crack=0.1))
# scree and pebbles around the foot, clear of the wall (|x| < 2.8 and -2.4 < Y < 1.6)
for i in range(16):
    for _ in range(30):
        ang = random.uniform(0, math.tau)
        rad = random.uniform(3.2, 7.2)
        x, y = math.cos(ang) * rad, math.sin(ang) * rad * 0.9
        if abs(x) < 2.9 and -2.6 < y < 1.8:
            continue
        if y < -3.5:
            continue
        break
    s = random.uniform(0.18, 0.5)
    (front_parts if i < 5 else back_parts).append(rock('peb%d' % i, (x, y, s * 0.35), (s * 1.2, s, s * 0.6), 20 + i, subdiv=4, square=0.3, rough=0.25, crack=0.0))


def join(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


backdrop = join(back_parts, 'backdrop')
foreground = join(front_parts, 'foreground')
crags = [(backdrop, 0.72), (foreground, 0.28)]


def decimate(ob, budget):
    tris0 = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = min(1.0, budget / max(1, tris0))
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier='dec')
    for p in ob.data.polygons:
        p.use_smooth = True
    print('DECIMATED', ob.name, tris0, '->', sum(len(p.vertices) - 2 for p in ob.data.polygons), 'VERTS', len(ob.data.vertices))


for ob, share in crags:
    decimate(ob, int(TARGET * share))

# ---- occluders for the AO (not exported): the ground, so the bottoms and the creases close up
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.02))
ground = bpy.context.active_object
ground.name = 'ground'

# ---- AO bake into a float vertex-colour attribute, one mesh at a time (the other stays in the scene as an occluder)
sc.world = bpy.data.worlds.new('w')
sc.world.use_nodes = True
sc.world.light_settings.distance = 3.5   # the AO bake's ray length (5.2 dropped light_settings.use_ambient_occlusion; the old line threw and was swallowed)
mat = bpy.data.materials.new('granite')
mat.use_nodes = True


def bake_one(crag):
    me = crag.data
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = 0
    me.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    crag.select_set(True)
    bpy.context.view_layer.objects.active = crag
    try:
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        print('AO BAKE OK', crag.name)
    except Exception as e:
        print('AO BAKE FAILED', crag.name, e)

    # ---- albedo x AO -> final vertex colour (floats, written raw: the site reads vertex colour as the number it should look like)
    n = len(me.vertices)
    ao = [1.0] * n
    buf = [0.0] * (n * 4)
    ca.data.foreach_get('color', buf)
    for i in range(n):
        ao[i] = max(0.0, min(1.0, buf[i * 4]))
    out = [0.0] * (n * 4)
    for i, v in enumerate(me.vertices):
        p = v.co
        nz = v.normal.z
        base = Vector((0.58, 0.58, 0.59))
        lump = fbm(p * 0.45 + Vector((3.1, 1.7, 9.2)), 3)                     # broad warm/cool drift
        spec = fbm(p * 7.0, 2)                                                  # speckle
        base = base * (1.0 + 0.18 * lump + 0.07 * spec)
        base = base.lerp(Vector((0.63, 0.60, 0.56)), max(0.0, lump) * 0.5)    # warm grain
        base = base.lerp(Vector((0.36, 0.40, 0.33)), max(0.0, fbm(p * 1.1 + Vector((8, 2, 5)), 3) - 0.1) * 1.6 * max(0.0, nz) * 0.5)   # lichen on upward faces
        streak = max(0.0, fbm(Vector((p.x * 2.2, p.y * 2.2, p.z * 0.35)) + Vector((4, 4, 1)), 3) - 0.12)
        base = base.lerp(Vector((0.50, 0.42, 0.35)), min(0.5, streak * 1.6) * (1.0 - max(0.0, nz) * 0.6))   # iron-stain drips
        cr = ridged(p * 1.6 + Vector((0.6, 0.6, 0.6)), 3)
        base = base * (1.0 - 0.45 * max(0.0, (cr - 0.68) / 0.32))              # crack linings
        shade = 0.30 + 0.70 * (ao[i] ** 1.15)
        out[i * 4:i * 4 + 4] = [base.x * shade, base.y * shade, base.z * shade, 1.0]
    ca.data.foreach_set('color', out)
    me.update()


for ob, _ in crags:
    bake_one(ob)

# ---- export (selection only: the ground stays behind). Two nodes, two meshes: 'backdrop' and 'foreground'.
bpy.data.objects.remove(ground)
bpy.ops.object.select_all(action='DESELECT')
for ob, _ in crags:
    ob.select_set(True)
bpy.context.view_layer.objects.active = backdrop
kw = dict(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_draco_mesh_compression_enable=False,
          export_materials='NONE', export_image_format='NONE', export_texcoords=False, export_cameras=False, export_lights=False)
try:
    bpy.ops.export_scene.gltf(export_vertex_color='ACTIVE', **kw)
except TypeError:
    bpy.ops.export_scene.gltf(export_active_vertex_color_when_no_material=True, **kw)
print('EXPORT_OK', OUT)
