"""Read the on-disk user preferences relevant to the M5 setup, and check them against Joseph's guide. Run headless WITHOUT --factory-startup
(the factory startup loads blank prefs, so every value would read as the default):
   Blender -b --python scripts/blender/read_prefs.py -- [out.json]
Prints PREFS_JSON {...} and PREFS_CHECK ok | MISMATCH [...]; exits 1 on a mismatch, so it can gate a run.
Compare with the GUI session (the preferences the NEXT quit will write): over the Blender MCP run the same expressions (read only) and diff the two."""
import json
import os
import sys

import bpy

EXPECT = {  # Joseph's guide section 1 + 5, and what m5_preset.apply_prefs() asserts per process
    'compute_device_type': 'METAL',
    'metalrt': 'AUTO',
    'use_online_access': True,                                      # without it the MCP add-on refuses to start (reset on 2026-10-10 when the GUI saved prefs)
    'gpu_on': True,                                                  # Apple M5 (GPU - 10 cores)
    'cpu_off': True,
    'use_preferences_save': True,                                    # the GUI writes prefs on quit: they must already hold the right values
    'texture_cache_directory': os.path.expanduser('~/AgentRuntime/cache/blender-tx'),
    'addons': ['bl_ext.blender_org.antlandscape', 'bl_ext.blender_org.ivygen', 'bl_ext.user_default.mcp'],
}

p = bpy.context.preferences
cp = p.addons['cycles'].preferences
(getattr(cp, 'refresh_devices', None) or cp.get_devices)()   # 5.2 renamed get_devices (now a deprecated alias) to refresh_devices
try:
    import addon_utils
    ext_versions = {m.__name__: list(getattr(m, 'bl_info', {}).get('version', [])) or None
                    for m in addon_utils.modules() if m.__name__.startswith('bl_ext.')}
except Exception as e:  # noqa: BLE001
    ext_versions = {'error': repr(e)}
d = {
    'version': bpy.app.version_string,
    'use_online_access': p.system.use_online_access,
    'compute_device_type': cp.compute_device_type,
    'metalrt': cp.metalrt,
    'devices': [(x.name, x.type, bool(x.use)) for x in cp.devices],
    'use_preferences_save': p.use_preferences_save,
    'texture_cache_directory': p.filepaths.texture_cache_directory,
    'memory_cache_limit': p.system.memory_cache_limit,
    'addons_enabled': sorted(k for k in p.addons.keys() if k.startswith('bl_ext.')),
    'extension_versions': ext_versions,
}
bad = []
for k in ('compute_device_type', 'metalrt', 'use_online_access', 'use_preferences_save', 'texture_cache_directory'):
    if d[k] != EXPECT[k]:
        bad.append((k, d[k], EXPECT[k]))
if not any(x[1] == 'METAL' and x[2] for x in d['devices']):
    bad.append(('gpu_on', False, True))
if any(x[1] == 'CPU' and x[2] for x in d['devices']):
    bad.append(('cpu_off', False, True))
for a in EXPECT['addons']:
    if a not in d['addons_enabled']:
        bad.append(('addon', 'not enabled', a))
print('PREFS_JSON ' + json.dumps(d))
print('PREFS_CHECK ' + ('ok' if not bad else 'MISMATCH ' + json.dumps(bad)))
if '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 1:
    json.dump(dict(d, check=bad), open(sys.argv[sys.argv.index('--') + 1], 'w'), indent=1)
if bad:
    sys.exit(1)
