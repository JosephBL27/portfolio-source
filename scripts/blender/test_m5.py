"""Headless self-test of the M5 plumbing: preset values in every mode, strict device switch, bake settings, the AO bake on Metal against the CPU.
    Blender -b --python-use-system-env -P scripts/blender/test_m5.py            (hold the one-Blender lock; swap under 24.5 GB first)
Prints M5_TEST {json} and exits 1 when a check fails. Uses a tiny scene (a cube just above a plane, 256 samples per vertex, three bakes): about 15 s, under 1.5 GB (the 2026-10-12 run: 4.4 s wall, 983 MB peak footprint).
Needs the saved user preferences (no --factory-startup), because apply_prefs() reads the Metal device list from them."""
import json
import os
import sys

import bpy
import bmesh

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lib
import m5_preset as m5

checks, out = [], {}


def check(name, ok, detail=None):
    checks.append((name, bool(ok), detail))


# ---- 1. the three modes, read back from a fresh scene
for mode, want in (('world', dict(samples=32, percent=50, simplify=True)), ('lookdev', dict(samples=64, percent=75, simplify=True)),
                   ('final', dict(samples=256, percent=100, simplify=False))):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m5.apply_prefs(quiet=True)
    rb = m5.apply(bpy.context.scene, mode)
    out[mode] = rb
    check(f'{mode}: Joseph values', rb['engine'] == 'CYCLES' and rb['device'] == 'GPU' and rb['adaptive'] and abs(rb['threshold'] - 0.03) < 1e-6
          and rb['max_bounces'] == 5 and rb['volume_bounces'] == 1 and rb['tile_size'] == 1024 and not rb['persistent_data'] and rb['denoising']
          and rb['view_transform'] == 'AgX' and rb['texture_cache'] and rb['auto_generate_texture_cache'], rb)
    check(f'{mode}: mode values', rb['samples'] == want['samples'] and rb['percent'] == want['percent'] and rb['simplify'] == want['simplify'], rb)
    check(f'{mode}: Metal + MetalRT Auto', rb['prefs']['compute_device_type'] == 'METAL' and rb['prefs']['metalrt'] == 'AUTO' and rb['prefs']['gpu_on'], rb['prefs'])
bpy.ops.wm.read_factory_settings(use_empty=True)
m5.apply_prefs(quiet=True)
rb = m5.apply(bpy.context.scene, 'final', res=m5.FINAL_RES)
check('final --res guide = 2560x1440', rb['res'] == [2560, 1440], rb['res'])
check('texture cache dir set for the process', bpy.context.preferences.filepaths.texture_cache_directory == os.path.expanduser(m5.TX_DIR))

# ---- 2. strict device switch and bake settings
sc = bpy.context.scene
check('configure_device cpu is explicit', m5.configure_device(sc, 'CPU')['device'] == 'CPU' and sc.cycles.device == 'CPU')
check('configure_device gpu restores Metal', m5.configure_device(sc, 'GPU')['device'] == 'GPU' and sc.cycles.device == 'GPU')
bk = m5.apply_bake(sc, 40)
out['bake'] = bk
check('apply_bake: no adaptive, no denoise, Standard, GPU', not bk['adaptive'] and not bk['denoising'] and bk['view_transform'] == 'Standard' and bk['device'] == 'GPU'
      and bk['samples'] == 40, bk)
os.environ['M5_DEVICE'] = 'cpu'
check('M5_DEVICE=cpu is honoured', m5.configure_device(sc)['device'] == 'CPU')
os.environ['M5_DEVICE'] = 'bogus'
try:
    m5.configure_device(sc)
    check('M5_DEVICE=bogus raises', False)
except ValueError:
    check('M5_DEVICE=bogus raises', True)
del os.environ['M5_DEVICE']


# ---- 3. lib.setup() + bake_ao: Metal against CPU on the same geometry
def build():
    me = bpy.data.meshes.new('floor')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=12, y_segments=12, size=3.0)
    bm.to_mesh(me)
    bm.free()
    fl = bpy.data.objects.new('floor', me)
    bpy.context.collection.objects.link(fl)
    me2 = bpy.data.meshes.new('cube')
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.4)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0.72))   # 2 cm off the floor: a bottom face coplanar with the floor hits or misses it by device-dependent epsilon (first run 2026-10-12: max diff 0.80)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=3, use_grid_fill=True)
    bm.to_mesh(me2)
    bm.free()
    cu = bpy.data.objects.new('cube', me2)
    bpy.context.collection.objects.link(cu)
    return fl, cu


def bake(device, seed=0):
    os.environ['M5_DEVICE'] = device
    sc = lib.setup(samples=256)
    sc.cycles.seed = seed
    fl, cu = build()
    import time
    t = time.time()
    lib.bake_ao([fl, cu], dist=1.0, smooth=0)
    dt = time.time() - t
    vals = []
    for ob in (fl, cu):
        ca = ob.data.color_attributes.active_color
        buf = [0.0] * (len(ob.data.vertices) * 4)
        ca.data.foreach_get('color', buf)
        vals.append(buf[0::4])
    dev = sc.cycles.device
    del os.environ['M5_DEVICE']
    return vals, dt, dev


gpu, t_gpu, d_gpu = bake('gpu')
cpu, t_cpu, d_cpu = bake('cpu')
cpu2, t_cpu2, d_cpu2 = bake('cpu', seed=7)      # the noise floor: the same device, another seed


def mad(a, b):
    xs = [abs(p - q) for va, vb in zip(a, b) for p, q in zip(va, vb)]
    return sum(xs) / len(xs), max(xs)


def mean(a):
    return sum(sum(v) for v in a) / sum(len(v) for v in a)


n = sum(len(v) for v in gpu)
d_gc, max_gc = mad(gpu, cpu)
d_cc, max_cc = mad(cpu, cpu2)
out['ao'] = {'verts': n, 'gpu_s': round(t_gpu, 2), 'cpu_s': round(t_cpu, 2), 'devices': [d_gpu, d_cpu, d_cpu2], 'mean_ao_gpu': round(mean(gpu), 4),
             'mean_ao_cpu': round(mean(cpu), 4), 'mean_abs_diff_gpu_cpu': round(d_gc, 4), 'max_abs_diff_gpu_cpu': round(max_gc, 4),
             'mean_abs_diff_cpu_cpu_reseeded': round(d_cc, 4), 'max_abs_diff_cpu_cpu_reseeded': round(max_cc, 4)}
check('AO bake ran on both devices', d_gpu == 'GPU' and d_cpu == 'CPU' and d_cpu2 == 'CPU' and 0.2 < mean(gpu) < 1.0 and 0.2 < mean(cpu) < 1.0, out['ao'])
# Per-vertex AO is a Monte Carlo estimate, so two bakes never match exactly: the right bar is the CPU-against-CPU (re-seeded) spread, not a fixed number.
check('AO bake: Metal vs CPU spread is no wider than CPU vs CPU re-seeded (x1.5 + 0.01), means within 0.02',
      d_gc <= 1.5 * d_cc + 0.01 and abs(mean(gpu) - mean(cpu)) < 0.02, out['ao'])

bad = [(n_, d) for n_, ok, d in checks if not ok]
print('M5_TEST ' + json.dumps({'checks': len(checks), 'failed': bad, 'out': out}, default=str))
sys.exit(1 if bad else 0)
