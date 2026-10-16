#!/usr/bin/env -S python3 -B -I
"""Render one .blend frame under several Cycles settings and tabulate time + memory (headless, one Blender at a time).
   python3 -B -I m5_bench.py file.blend out_dir variant [variant ...]     variants: base tile512 tile256 tile2048 rtoff rton gpudenoise
Each variant runs `Blender -b file.blend --python-expr <override> -o ... -f 1 -- --cycles-print-stats` under /usr/bin/time -l.
Reports: wall s, Cycles 'Time', max device 'Mem:' (MB, unified memory on Apple Silicon), peak RSS, peak footprint.
Guards: refuses to start a variant when swap used is above SWAP_CAP_GB (default 24.5); passes --python-use-system-env so PYTHONDONTWRITEBYTECODE is honoured.
Hold the one-Blender lock yourself (mkdir /private/tmp/claude-501/blender-<round>.lock) while this runs."""
import json, os, re, subprocess, sys, time
B = '/Applications/Blender.app/Contents/MacOS/Blender'
CAP = float(os.environ.get('SWAP_CAP_GB', '24.5'))
ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', PYTHONNOUSERSITE='1')


def swap_used_gb():
    m = re.search(r'used = ([\d.]+)M', subprocess.run(['sysctl', '-n', 'vm.swapusage'], capture_output=True, text=True).stdout)
    return float(m.group(1)) / 1000 if m else 0.0  # MB / 1000: the strict reading of Joseph's 25 GB cap
OV = {
    'base': '',
    'tile512': "bpy.context.scene.cycles.tile_size=512",
    'tile256': "bpy.context.scene.cycles.tile_size=256",
    'tile2048': "bpy.context.scene.cycles.tile_size=2048",
    'rtoff': "bpy.context.preferences.addons['cycles'].preferences.metalrt='OFF'",
    'rton': "bpy.context.preferences.addons['cycles'].preferences.metalrt='ON'",
    'gpudenoise': "bpy.context.scene.cycles.denoising_use_gpu=True",
}
blend, out, *variants = sys.argv[1:]
os.makedirs(out, exist_ok=True)
rows = []
for v in variants:
    if swap_used_gb() > CAP:
        print(json.dumps({'variant': v, 'skipped': f'swap {swap_used_gb():.1f} GB above the {CAP} GB cap'}), flush=True)
        break
    expr = 'import bpy;' + OV[v] if OV[v] else 'import bpy'
    cmd = ['/usr/bin/time', '-l', B, '--python-use-system-env', '-b', blend, '--python-expr', expr, '-o', os.path.join(out, f'bench_{v}_'), '-F', 'PNG', '-f', '1', '--', '--cycles-print-stats']
    t = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=900, env=ENV)
    wall = time.time() - t
    txt = p.stdout + p.stderr
    mems = [int(m) for m in re.findall(r'Mem: (\d+)M', txt)]
    ct = re.search(r'Time: (\d+):([\d.]+) \(Saving', txt)
    rss = re.search(r'(\d+)\s+maximum resident set size', txt)
    fp = re.search(r'(\d+)\s+peak memory footprint', txt)
    rows.append({'variant': v, 'wall_s': round(wall, 1), 'cycles_time_s': round(int(ct.group(1)) * 60 + float(ct.group(2)), 1) if ct else None,
                 'max_device_mem_mb': max(mems) if mems else None, 'peak_rss_mb': round(int(rss.group(1)) / 1e6) if rss else None,
                 'peak_footprint_mb': round(int(fp.group(1)) / 1e6) if fp else None, 'rc': p.returncode})
    print(json.dumps(rows[-1]), flush=True)
    with open(os.path.join(out, 'bench.jsonl'), 'a') as f:
        f.write(json.dumps(rows[-1]) + '\n')
