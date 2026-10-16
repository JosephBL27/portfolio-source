# Look-dev preview of the "hold" field without a browser: rebuilds what the site composites, in Cycles, from the dwell camera.
#   floor  emission = the backdrop HDRI looked up along (position - eye) (the site's photo projection) x the baked shadow ratio (field-light.png)
#   rocks / ferns  emission = their map x the baked vertex light x GAIN;  hero boulder + pads: lit by the HDRI and the bake's sun
#   Blender -b --factory-startup -P scripts/blender/hold_field_preview.py -- <hdri.exr> <hold-field.glb> <field-light.png> <hero.glb> <out.png> [--yaw=0] [--rot=-30] [--spp=24]
# Approximate by design: Standard view, one exposure for everything (the site's display-space 0.66 ~ -1.3 stops); the climber and the DOM are not in it.
import bpy, sys, os, math
from mathutils import Vector, Matrix
sys.dont_write_bytecode = True   # Blender ignores PYTHONDONTWRITEBYTECODE; keeps __pycache__ out of the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m5_preset
argv = sys.argv[sys.argv.index('--') + 1:]
HDRI, FIELD, LIGHT, HERO, OUT = argv[:5]
opt = {a.split('=')[0]: a.split('=')[1] for a in argv[5:] if '=' in a}
YAW = float(opt.get('--yaw', 0)); ROT = float(opt.get('--rot', -30)); SPP = int(opt.get('--spp', 24))
EYE = Vector((0, -13.1, 3.3)); TGT = Vector((0, 0, 2.75)); PADS = [(-0.85, 0.06, 3.9, 1.5, 0.12, 1.2, 0.32), (0.62, 0.055, 4.75, 1.3, 0.11, 1.05, -0.26)]; SY = 0.1
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = SPP; sc.cycles.use_denoising = True
m5_preset.configure_device(sc)   # Metal GPU, raises instead of the old silent CPU fallback; M5_DEVICE=cpu forces the CPU
sc.view_settings.view_transform = 'Standard'; sc.view_settings.exposure = -1.3
w = bpy.data.worlds.new('w'); sc.world = w; nt = w.node_tree; nt.nodes.clear()
tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); env = nt.nodes.new('ShaderNodeTexEnvironment'); bg = nt.nodes.new('ShaderNodeBackground'); wo = nt.nodes.new('ShaderNodeOutputWorld')
img = bpy.data.images.load(HDRI); env.image = img; mp.inputs['Rotation'].default_value[2] = math.radians(ROT)
nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], env.inputs['Vector']); nt.links.new(env.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs[0], wo.inputs['Surface'])

def emission_mat(name, build):
    m = bpy.data.materials.new(name); t = m.node_tree; t.nodes.clear(); o = t.nodes.new('ShaderNodeOutputMaterial'); build(t, o); return m

before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=FIELD)
for ob in [o for o in bpy.data.objects if o not in before and o.type == 'MESH']:
    me = ob.data; name = ob.name
    if name.startswith('terrain'):
        def b(t, o):
            geo = t.nodes.new('ShaderNodeNewGeometry'); sub = t.nodes.new('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = EYE
            nrm = t.nodes.new('ShaderNodeVectorMath'); nrm.operation = 'NORMALIZE'; m2 = t.nodes.new('ShaderNodeMapping'); m2.vector_type = 'VECTOR'; m2.inputs['Rotation'].default_value[2] = math.radians(ROT)
            e2 = t.nodes.new('ShaderNodeTexEnvironment'); e2.image = img
            uvn = t.nodes.new('ShaderNodeUVMap'); uvn.uv_map = me.uv_layers[0].name; li = t.nodes.new('ShaderNodeTexImage'); li.image = bpy.data.images.load(LIGHT); li.image.colorspace_settings.name = 'Non-Color'
            mul = t.nodes.new('ShaderNodeMixRGB'); mul.blend_type = 'MULTIPLY'; mul.inputs[0].default_value = 1.0
            em = t.nodes.new('ShaderNodeEmission')
            t.links.new(geo.outputs['Position'], sub.inputs[0]); t.links.new(sub.outputs[0], nrm.inputs[0]); t.links.new(nrm.outputs[0], m2.inputs['Vector']); t.links.new(m2.outputs[0], e2.inputs['Vector'])
            t.links.new(uvn.outputs[0], li.inputs['Vector']); gs = t.nodes.new('ShaderNodeGamma'); gs.inputs[1].default_value = 2.2; t.links.new(li.outputs['Color'], gs.inputs[0]); t.links.new(e2.outputs['Color'], mul.inputs[1]); t.links.new(gs.outputs[0], mul.inputs[2]); t.links.new(mul.outputs[0], em.inputs['Color']); t.links.new(em.outputs[0], o.inputs['Surface'])
        mat = emission_mat('floor', b)
    else:
        src = me.materials[0] if me.materials else None
        tex = [n for n in src.node_tree.nodes if n.type == 'TEX_IMAGE'][0].image if src else None
        attr = me.color_attributes[0].name if me.color_attributes else 'Col'
        cut = name.startswith('fern')
        def b(t, o, tex=tex, attr=attr, cut=cut):
            ti = t.nodes.new('ShaderNodeTexImage'); ti.image = tex; ca = t.nodes.new('ShaderNodeVertexColor'); ca.layer_name = attr
            mul = t.nodes.new('ShaderNodeMixRGB'); mul.blend_type = 'MULTIPLY'; mul.inputs[0].default_value = 1.0
            # the map is display-referred raw bytes and L is display / GAIN: the product is a display value; back to linear for Cycles (x2 gain, ^2.2)
            g = t.nodes.new('ShaderNodeMath'); g.operation = 'MULTIPLY'; g.inputs[1].default_value = 2.0
            em = t.nodes.new('ShaderNodeEmission'); gm = t.nodes.new('ShaderNodeGamma'); gm.inputs[1].default_value = 1.0
            ti.image.colorspace_settings.name = 'sRGB'
            gm.inputs[1].default_value = 2.2; t.links.new(ca.outputs['Color'], gm.inputs[0])
            t.links.new(ti.outputs['Color'], mul.inputs[1]); t.links.new(gm.outputs[0], mul.inputs[2])
            sc2 = t.nodes.new('ShaderNodeVectorMath'); sc2.operation = 'SCALE'; sc2.inputs['Scale'].default_value = 2.0 ** 2.2
            t.links.new(mul.outputs[0], sc2.inputs[0]); t.links.new(sc2.outputs[0], em.inputs['Color'])
            if cut:
                mx = t.nodes.new('ShaderNodeMixShader'); tr = t.nodes.new('ShaderNodeBsdfTransparent'); t.links.new(ti.outputs['Alpha'], mx.inputs['Fac']); t.links.new(tr.outputs[0], mx.inputs[1]); t.links.new(em.outputs[0], mx.inputs[2]); t.links.new(mx.outputs[0], o.inputs['Surface'])
            else: t.links.new(em.outputs[0], o.inputs['Surface'])
        mat = emission_mat('ins-' + name, b)
    me.materials.clear(); me.materials.append(mat)
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=HERO)
hb = [o for o in bpy.data.objects if o not in before and o.type == 'MESH'][0]; hb.parent = None
hb.matrix_world = Matrix.Identity(4); bpy.context.view_layer.objects.active = hb; hb.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
zs = [v.co.z for v in hb.data.vertices]; xs = [v.co.x for v in hb.data.vertices]; ys = [v.co.y for v in hb.data.vertices]; s = 3.3 / (max(zs) - min(zs))
hb.data.transform(Matrix.Translation((-(max(xs) + min(xs)) / 2, -(max(ys) + min(ys)) / 2, -min(zs)))); hb.matrix_world = Matrix.Rotation(0.5 + SY, 4, 'Z') @ Matrix.Diagonal((s, s, s, 1))
import bmesh
for i, (x, y, z, sx, sy, sz, yaw) in enumerate(PADS):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); me = bpy.data.meshes.new(f'pad{i}'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(f'pad{i}', me); sc.collection.objects.link(ob)
    pm = bpy.data.materials.new('p'); pm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = ((0.012, 0.025, 0.018, 1) if i == 0 else (0.024, 0.027, 0.04, 1)); pm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9; me.materials.append(pm)
    c = Matrix.Rotation(SY, 4, 'Z') @ Vector((x, -z, y)); ob.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(SY + yaw, 4, 'Z') @ Matrix.Diagonal((sx, sz, sy, 1))
if opt.get('--climber'):        # a posed climber (out/tools/route-test.mjs: the site's IK, CPU-skinned, site axes, stage frame): display-value colours -> linear
    before = set(bpy.data.objects); bpy.ops.wm.obj_import(filepath=opt['--climber'], forward_axis='NEGATIVE_Z', up_axis='Y')
    for ob in [o for o in bpy.data.objects if o not in before]:
        ob.matrix_world = Matrix.Rotation(SY, 4, 'Z') @ ob.matrix_world
        for m in ob.data.materials:
            bs = m.node_tree.nodes.get('Principled BSDF')
            if bs:
                c = bs.inputs['Base Color'].default_value; bs.inputs['Base Color'].default_value = (c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2, 1); bs.inputs['Roughness'].default_value = 0.8
        for f in ob.data.polygons: f.use_smooth = True
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 2.72; sun.angle = math.radians(2); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
d = Vector((0.752, -0.146, 0.643)).normalized(); so.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
cam = bpy.data.cameras.new('c'); cam.sensor_fit = 'VERTICAL'; cam.angle_y = math.radians(44); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
LEAN = float(opt.get('--lean', 0)); PULL = float(opt.get('--pull', 0)); FY = float(opt.get('--fy', 2.75))     # extras/climbcam.ts: zoom + aim at the climber, pull-back on the send
back = 1 + 0.6 * PULL; cam.angle_y = math.radians(44 * (1 - 0.3 * LEAN))
EYE = Vector((TGT.x + (EYE.x - TGT.x) * back, TGT.y + (EYE.y - TGT.y) * back, EYE.z + 2.4 * PULL)); TGT = Vector((TGT.x, TGT.y, TGT.z + (FY - TGT.z) * 0.75 * LEAN + 0.9 * PULL))
co.location = EYE; dirv = (TGT - EYE); a = math.radians(YAW); dirv = Matrix.Rotation(-a, 3, 'Z') @ dirv     # +yaw = to the right
co.rotation_euler = dirv.to_track_quat('-Z', 'Y').to_euler()
sc.render.resolution_x, sc.render.resolution_y = 1440, 900; sc.render.resolution_percentage = 50; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True); print('PREVIEW_OK', OUT)
