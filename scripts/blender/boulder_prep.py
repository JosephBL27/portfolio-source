# Prepare a Poly Haven photogrammetry rock for the web (CC0 source, see src/data/credits.json): decimate, shrink the textures, export a Draco GLB with WebP textures.
#   Blender -b -P scripts/blender/boulder_prep.py -- <in.gltf> <out.glb> [target_tris=30000] [tex=1024]
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
target = int(argv[2]) if len(argv) > 2 else 30000
tex = int(argv[3]) if len(argv) > 3 else 1024
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    o.select_set(True); bpy.context.view_layer.objects.active = o
    n = len(o.data.polygons) * 1  # tris (source is triangulated)
    m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = min(1.0, target / max(1, n))
    bpy.ops.object.modifier_apply(modifier='dec')
    print('tris', n, '->', len(o.data.polygons))
for im in bpy.data.images:
    if im.size[0] > tex:
        im.scale(tex, tex)
print('images', [(i.name, tuple(i.size)) for i in bpy.data.images])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP', export_image_quality=82,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7, export_draco_position_quantization=14,
    export_draco_normal_quantization=10, export_draco_texcoord_quantization=12, export_yup=True)
print('wrote', out, os.path.getsize(out))
