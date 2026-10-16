"""Control-flow test of m5_preset and lib.setup against a STUBBED bpy: no Blender, no GPU, no swap. Checks call order, strictness (no Metal raises, CPU refused in a GUI
session, M5_DEVICE) and the values set for each mode. It cannot prove Blender accepts the property names: that is test_m5.py.
    python3 -B -I scripts/blender/test_m5_stub.py [scripts/blender dir]"""
import os, sys, types
from unittest.mock import MagicMock
sys.dont_write_bytecode = True
HERE = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
bpy = MagicMock(name='bpy'); bpy.app.background = True
class Dev:
    def __init__(s, n, t, u=False): s.name, s.type, s.use = n, t, u
cp = types.SimpleNamespace(compute_device_type='NONE', metalrt='OFF', devices=[Dev('Apple M5', 'CPU', True), Dev('Apple M5 (GPU - 10 cores)', 'METAL', False)])
calls = []
cp.get_devices = lambda: calls.append('get_devices')      # deprecated alias: the module must not need it when refresh_devices exists
cp.refresh_devices = lambda: calls.append('refresh_devices')
prefs = types.SimpleNamespace(addons={'cycles': types.SimpleNamespace(preferences=cp)}, filepaths=types.SimpleNamespace(texture_cache_directory=''))
bpy.context.preferences = prefs
sc = types.SimpleNamespace(render=types.SimpleNamespace(resolution_x=1920, resolution_y=1080), cycles=types.SimpleNamespace(max_bounces=12), view_settings=types.SimpleNamespace(), world=None)
bpy.context.scene = sc
sys.modules.update({'bpy': bpy, 'bmesh': MagicMock(), 'mathutils': MagicMock()})
sys.path.insert(0, HERE)
import m5_preset as m5
ok = []
r = m5.configure_device(sc, 'GPU'); ok.append(('gpu', r['device'] == 'GPU' and sc.cycles.device == 'GPU' and cp.compute_device_type == 'METAL' and cp.metalrt == 'AUTO' and [d.use for d in cp.devices] == [False, True]))
ok.append(('refresh_devices, not the deprecated alias', calls == ['refresh_devices']))
ok.append(('tx dir', prefs.filepaths.texture_cache_directory == os.path.expanduser(m5.TX_DIR)))
r = m5.apply_bake(sc, 40); ok.append(('bake', r['samples'] == 40 and not sc.cycles.use_adaptive_sampling and not sc.cycles.use_denoising and sc.view_settings.view_transform == 'Standard' and sc.render.use_texture_cache))
r = m5.apply_bake(sc, 40, bounces=5); ok.append(('bake bounces', sc.cycles.max_bounces == 5 and sc.cycles.volume_bounces == 1))
for mode, samples, pct in (('world', 32, 50), ('lookdev', 64, 75), ('final', 256, 100)):
    r = m5.apply(sc, mode, res=m5.FINAL_RES if mode == 'final' else None)
    ok.append((mode, r['samples'] == samples and r['percent'] == pct and sc.cycles.adaptive_threshold == 0.03 and sc.render.simplify_subdivision == 1))
ok.append(('res', (sc.render.resolution_x, sc.render.resolution_y) == (2560, 1440)))
r = m5.configure_device(sc, 'CPU'); ok.append(('cpu', r['device'] == 'CPU' and sc.cycles.device == 'CPU' and cp.compute_device_type == 'NONE'))
del cp.refresh_devices; calls.clear(); m5.apply_prefs(quiet=True); ok.append(('old build falls back to get_devices', calls == ['get_devices'])); cp.refresh_devices = lambda: calls.append('refresh_devices')
bpy.app.background = False
try: m5.configure_device(sc, 'CPU'); ok.append(('cpu in GUI refused', False))
except RuntimeError: ok.append(('cpu in GUI refused', True))
bpy.app.background = True
cp.devices = [Dev('Apple M5', 'CPU', True)]
try: m5.configure_device(sc, 'GPU'); ok.append(('no metal raises', False))
except RuntimeError: ok.append(('no metal raises', True))
os.environ['M5_DEVICE'] = 'cpu'; ok.append(('env cpu', m5.device_from_env() == 'CPU')); del os.environ['M5_DEVICE']
cp.devices = [Dev('Apple M5', 'CPU', True), Dev('GPU', 'METAL', False)]
import lib
s2 = lib.setup(samples=24); ok.append(('lib.setup', s2 is sc and sc.cycles.samples == 24 and sc.cycles.device == 'GPU' and not sc.cycles.use_denoising))
os.environ['M5_DEVICE'] = 'cpu'; s3 = lib.setup(samples=8); ok.append(('lib.setup cpu', sc.cycles.device == 'CPU')); del os.environ['M5_DEVICE']
bad = [n for n, v in ok if not v]
print('STUB_TEST', len(ok), 'checks, failed:', bad)
sys.exit(1 if bad else 0)
