import bpy
sc = bpy.data.scenes['hall_photoreal']
orig = bpy.data.materials.get('hp_glassbake')
for i in range(5):
    g = bpy.data.objects.get('X_glass%d' % i)
    if g and orig: g.material_slots[0].material = orig
for n in ('PV_hp_hall', 'PV_hp_props'):
    ob = bpy.data.objects.get(n)
    if ob:
        me = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        if me.users == 0: bpy.data.meshes.remove(me)
for n in ('hp_hall', 'hp_props', 'hp_flames'):
    ob = bpy.data.objects.get(n)
    if ob: ob.hide_render = False
for m in [m for m in bpy.data.materials if m.name.startswith('PV_')]:
    bpy.data.materials.remove(m)
im = bpy.data.images.get('PV_lm')
if im: bpy.data.images.remove(im)
sc.view_settings.view_transform = 'Standard'
