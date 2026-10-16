"""Smoke test of the Sapling Tree Gen extension on this Blender, in a THROWAWAY profile (Joseph's live prefs and extensions are never touched).
    ZIP=<sapling_tree_gen-x.y.z.zip, sha256 checked against its release>   PROFILE=$(mktemp -d)
    BLENDER_USER_RESOURCES=$PROFILE Blender -b --factory-startup -c extension install-file -r user_default -e "$ZIP"
    BLENDER_USER_RESOURCES=$PROFILE Blender -b --factory-startup -P scripts/blender/sapling_smoke.py -- acer
Generates a tree from a preset, steps the wind animation over a few frames, prints SAPLING_SMOKE {json}; exits 1 on any error.
Evaluated 2026-10-12 against 5.2.2 LTS (docs/toolchain/blender-m5-audit.md, section 11). Not part of any shipped pipeline: the guide prefers photographed trees."""
import json
import sys
import traceback

import bpy

preset = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 1 else 'acer'
res = {'blender': bpy.app.version_string, 'preset': preset, 'errors': []}
try:
    mods = [m for m in bpy.context.preferences.addons.keys() if 'sapling' in m]
    res['addon_enabled'] = mods
    res['operator_present'] = hasattr(bpy.ops.curve, 'tree_add')
    before = set(bpy.data.objects.keys())
    r = bpy.ops.curve.tree_add(preset=preset)
    res['operator_result'] = sorted(r)
    new = [o for o in bpy.data.objects if o.name not in before]
    res['objects'] = [(o.name, o.type) for o in new]
    dg = bpy.context.evaluated_depsgraph_get()
    verts = tris = 0
    for o in new:
        ev = o.evaluated_get(dg)
        try:
            me = ev.to_mesh()
            verts += len(me.vertices)
            tris += sum(max(0, len(p.vertices) - 2) for p in me.polygons)
            ev.to_mesh_clear()
        except Exception:  # curves, armatures, empties have no mesh
            pass
    res['evaluated_vertices'] = verts
    res['evaluated_tris'] = tris
    sc = bpy.context.scene
    for f in (1, 12, 24, 48):
        sc.frame_set(f)
        bpy.context.view_layer.update()
    res['wind_frames_stepped'] = [1, 12, 24, 48]
except Exception:
    res['errors'].append(traceback.format_exc())
res['ok'] = not res['errors'] and res.get('operator_result') == ['FINISHED'] and res.get('evaluated_vertices', 0) > 0
print('SAPLING_SMOKE ' + json.dumps(res))
sys.exit(0 if res['ok'] else 1)
