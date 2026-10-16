# Blender (live, via the MCP): preview the SHIPPED look (albedo x display lightmap, props albedo x vertex light) in the open session's hall_photoreal scene, from the site's hall camera.
# needs PV_LM (path of hall_light.webp) in the exec namespace. pv_off.py restores the scene.
import bpy, math
from mathutils import Vector
sc = bpy.data.scenes['hall_photoreal']
hall = bpy.data.objects['hp_hall']; props = bpy.data.objects['hp_props']
srgb = lambda c: 12.92*c if c <= 0.0031308 else 1.055*(c ** (1/2.4)) - 0.055
old = bpy.data.images.get('PV_lm')
if old: bpy.data.images.remove(old)
lm = bpy.data.images.load(PV_LM); lm.name = 'PV_lm'; lm.colorspace_settings.name = 'Non-Color'
def albedo_of(m):
    img, col = None, (0.5, 0.5, 0.5)
    if m and m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and n.image.name not in ('hp_dummy_ao', 'hp_lightmap') and not n.name.startswith('LM_TARGET'):
                img = n.image
            if n.type == 'BSDF_PRINCIPLED':
                col = tuple(n.inputs['Base Color'].default_value)[:3]
    return img, col
def pv_mat(src, mode):
    img, col = albedo_of(src)
    m = bpy.data.materials.new('PV_' + src.name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs[0])
    if img:
        img.colorspace_settings.name = 'Non-Color'
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
        u = nt.nodes.new('ShaderNodeUVMap'); u.uv_map = 'uv0'
        nt.links.new(u.outputs[0], t.inputs[0]); alb = t.outputs[0]
    else:
        v = nt.nodes.new('ShaderNodeRGB'); v.outputs[0].default_value = (srgb(col[0]), srgb(col[1]), srgb(col[2]), 1); alb = v.outputs[0]
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
    nt.links.new(alb, mix.inputs[6])
    if mode == 'lm':
        l = nt.nodes.new('ShaderNodeTexImage'); l.image = lm
        u2 = nt.nodes.new('ShaderNodeUVMap'); u2.uv_map = 'lm'
        nt.links.new(u2.outputs[0], l.inputs[0]); nt.links.new(l.outputs[0], mix.inputs[7])
    else:
        a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_name = 'Col'
        nt.links.new(a.outputs[0], mix.inputs[7])
    nt.links.new(mix.outputs[2], em.inputs[0])
    if mode == 'lm' and globals().get('PV_VAULT'):
        a, b, k = PV_VAULT
        gp = nt.nodes.new('ShaderNodeNewGeometry'); sp = nt.nodes.new('ShaderNodeSeparateXYZ')
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'; mr.clamp = True
        mr.inputs[1].default_value = a; mr.inputs[2].default_value = b; mr.inputs[3].default_value = 1.0; mr.inputs[4].default_value = 1.0 - k
        nt.links.new(gp.outputs['Position'], sp.inputs[0]); nt.links.new(sp.outputs['Z'], mr.inputs[0]); nt.links.new(mr.outputs[0], em.inputs['Strength'])
    return m
for src_ob, mode in ((hall, 'lm'), (props, 'col')):
    ob = src_ob.copy(); ob.data = src_ob.data.copy(); ob.name = 'PV_' + src_ob.name
    sc.collection.objects.link(ob)
    for i in range(len(ob.material_slots)):
        ob.material_slots[i].material = pv_mat(src_ob.data.materials[i], mode)
    src_ob.hide_render = True
atlas = bpy.data.images.get('hp_glass_atlas'); atlas.colorspace_settings.name = 'Non-Color'
gm = bpy.data.materials.new('PV_glass'); gm.use_nodes = True; nt = gm.node_tree; nt.nodes.clear()
o = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission'); t = nt.nodes.new('ShaderNodeTexImage'); t.image = atlas
u = nt.nodes.new('ShaderNodeUVMap'); u.uv_map = 'uv0'
nt.links.new(u.outputs[0], t.inputs[0]); nt.links.new(t.outputs[0], e.inputs[0]); nt.links.new(e.outputs[0], o.inputs[0])
for i in range(5):
    bpy.data.objects['X_glass%d' % i].material_slots[0].material = gm
fl = bpy.data.objects.get('hp_flames')
if fl: fl.hide_render = True
sc.view_settings.view_transform = 'Raw'; sc.cycles.samples = 8
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1440, 900, 100
cam = bpy.data.objects.get('X_cam_site')
if cam is None:
    cd = bpy.data.cameras.new('hp_cam_site'); cam = bpy.data.objects.new('X_cam_site', cd); sc.collection.objects.link(cam)
cam.data.sensor_fit = 'VERTICAL'; cam.data.sensor_height = 24; cam.data.angle_y = math.radians(46)
S = lambda x, y, z: Vector((x, -z, y))
cam.location = S(*PV_CAM[0]); cam.rotation_euler = (S(*PV_CAM[1]) - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam
