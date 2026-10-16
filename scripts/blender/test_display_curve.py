"""display_curve.py against the three implementations it replaced and against scripts/hdri-prep.mjs.
    python3 -B -I scripts/blender/test_display_curve.py      (needs numpy and node; no Blender)
Exit 0 = identical (float32 results equal, 8-bit values equal to the node maths of hdri-prep.mjs)."""
import json, os, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)
import display_curve as dc

rng = np.random.default_rng(7)
rgb = (rng.random((20000, 3)) ** 2.2 * 6.0).astype(np.float32)
rgb[:3] = [[0, 0, 0], [0.8, 0.8, 0.8], [5, 0.2, 0.1]]


def crag_ring_old(px, expo):          # crag_ring.py curve_to_display, verbatim maths
    r = px.reshape(-1, 4)[:, :3] * expo
    m = np.maximum(r.max(axis=1), 1e-6)
    t = np.where(m <= 0.8, 1.0, (0.8 + 0.2 * (1 - np.exp(-(m - 0.8) / 0.2))) / m)
    r = np.clip(r * t[:, None], 0, 1)
    return np.where(r <= 0.0031308, 12.92 * r, 1.055 * np.power(r, 1 / 2.4) - 0.055)


def hold_field_old(r):                # hold_field.py curve(), verbatim maths
    def srgb(x): return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.maximum(x, 0), 1 / 2.4) - 0.055)
    m = np.maximum(r.max(axis=-1), 1e-6); t = np.where(m <= 0.8, 1.0, (0.8 + 0.2 * (1 - np.exp(-(m - 0.8) / 0.2))) / m)
    return srgb(np.clip(r * t[..., None], 0, 1))


def hall_old(r, E):                   # hall_photoreal.py _encode, verbatim maths (knee 0.5)
    def tone(v): return np.where(v <= 0.5, v, 0.5 + 0.5 * (1.0 - np.exp(-(v - 0.5) / 0.5)))
    def oetf(x):
        x = np.clip(x, 0.0, 1.0); return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)
    v = r * E; m = np.max(v, axis=-1, keepdims=True)
    k = np.where(m > 1e-6, tone(m) / np.maximum(m, 1e-6), 1.0)
    return oetf(v * k)


px = np.concatenate([rgb, np.ones((len(rgb), 1), np.float32)], axis=1).reshape(-1)
ok = True
a, b = dc.shoulder_srgb(rgb.reshape(-1, 3), 0.7), crag_ring_old(px, 0.7)
d1 = float(np.abs(a - b).max()); ok &= d1 < 1e-6
c, e = dc.shoulder_srgb(rgb.astype(np.float64)), hold_field_old(rgb.astype(np.float64))
d2 = float(np.abs(c - e).max()); ok &= d2 < 1e-12
f, g = dc.shoulder_srgb(rgb, 1.3, knee=0.5), hall_old(rgb, 1.3)
d3 = float(np.abs(f - g).max()); ok &= d3 < 1e-5
js = r'''
const rgb = JSON.parse(require('fs').readFileSync(0, 'utf8')); const srgb = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); const out = [];
for (const [r, g, b] of rgb) { const m = Math.max(r, g, b, 1e-6); const t = m <= 0.8 ? 1 : (0.8 + (1 - 0.8) * (1 - Math.exp(-(m - 0.8) / 0.2))) / m;
  out.push([r, g, b].map(v => Math.round(255 * Math.min(1, srgb(v * t))))) } process.stdout.write(JSON.stringify(out))'''
sample = rgb[:2000].astype(np.float64)
res = subprocess.run(['node', '-e', js], input=json.dumps(sample.tolist()), capture_output=True, text=True, check=True)
node8 = np.array(json.loads(res.stdout))
py8 = np.round(255 * dc.shoulder_srgb(sample)).astype(int)
d4 = int(np.abs(node8 - py8).max()); ok &= d4 <= 1   # float32 vs float64 may flip a rounding by one level
print(json.dumps({'crag_ring_max_abs_diff': d1, 'hold_field_max_abs_diff': d2, 'hall_knee05_max_abs_diff': d3, 'hdri_prep_mjs_max_8bit_diff': d4, 'ok': bool(ok)}))
sys.exit(0 if ok else 1)
