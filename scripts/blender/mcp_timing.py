#!/usr/bin/env python3 -I
"""Time every Blender MCP tool family with a real MCP stdio client (the same server the agents use).

  python3 -I mcp_timing.py <proof.blend> <out.json>

Talks JSON-RPC (newline-delimited) to `blender-mcp`, which talks to the open GUI Blender on localhost:9876 (plain tools) or starts
a background Blender (the *_for_cli tools). Read-only calls plus two renders into a scratch dir. Never touches scene data.
"""
import json
import os
import subprocess
import sys
import threading
import time

BLEND = sys.argv[1]
OUTJ = sys.argv[2]
SCRATCH = os.path.join(os.path.dirname(OUTJ), 'mcp_scratch')
os.makedirs(SCRATCH, exist_ok=True)

env = dict(os.environ, BLENDER_PATH='/Applications/Blender.app/Contents/MacOS/Blender')
proc = subprocess.Popen([os.path.expanduser('~/.local/bin/blender-mcp')], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                        stderr=subprocess.DEVNULL, env=env, text=True, bufsize=1)
_lock = threading.Lock()
_resp = {}
_ev = {}


def reader():
    for line in proc.stdout:
        line = line.strip()
        if not line.startswith('{'):
            continue
        try:
            m = json.loads(line)
        except Exception:
            continue
        if 'id' in m:
            with _lock:
                _resp[m['id']] = m
            _ev.setdefault(m['id'], threading.Event()).set()


threading.Thread(target=reader, daemon=True).start()
_n = [0]


def rpc(method, params=None, timeout=180, notify=False):
    msg = {'jsonrpc': '2.0', 'method': method}
    if params is not None:
        msg['params'] = params
    if not notify:
        _n[0] += 1
        msg['id'] = _n[0]
        _ev[msg['id']] = threading.Event()
    t = time.perf_counter()
    proc.stdin.write(json.dumps(msg) + '\n')
    proc.stdin.flush()
    if notify:
        return None, 0
    ok = _ev[msg['id']].wait(timeout)
    dt = time.perf_counter() - t
    return (_resp.get(msg['id']) if ok else {'error': 'timeout'}), dt


t0 = time.perf_counter()
r, dt = rpc('initialize', {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'r5-timing', 'version': '1'}})
init_s = time.perf_counter() - t0
rpc('notifications/initialized', {}, notify=True)
tools, _ = rpc('tools/list')
names = [t['name'] for t in tools['result']['tools']]

rows = []


def call(label, tool, args, reps=1, family='gui'):
    for i in range(reps):
        r, dt = rpc('tools/call', {'name': tool, 'arguments': args}, timeout=240)
        res = (r or {}).get('result', {})
        err = bool(res.get('isError')) or 'error' in (r or {})
        txt = ''
        for c in res.get('content', []):
            if c.get('type') == 'text':
                txt += c['text'][:160]
            else:
                txt += f"[{c.get('type')} {len(c.get('data', ''))} b64 chars]"
        rows.append({'label': label, 'tool': tool, 'family': family, 'rep': i + 1, 'seconds': round(dt, 3), 'error': err, 'sample': txt[:200]})
        print(json.dumps(rows[-1]), flush=True)


call('path info (GUI)', 'get_blendfile_summary_path_info', {}, 3, 'summary')
call('datablocks (GUI)', 'get_blendfile_summary_datablocks', {}, 3, 'summary')
call('objects summary (GUI)', 'get_objects_summary', {}, 3, 'summary')
call('api docs search', 'search_api_docs', {'query': 'use_texture_cache', 'max_results': 3}, 3, 'docs')
call('api docs exact', 'get_python_api_docs', {'identifier': 'bpy.types.RenderSettings.use_texture_cache'}, 3, 'docs')
call('execute trivial (GUI)', 'execute_blender_code', {'code': 'import bpy\nresult={"v":bpy.app.version_string}'}, 5, 'execute')
call('execute prefs read (GUI)', 'execute_blender_code',
     {'code': "import bpy\np=bpy.context.preferences.addons['cycles'].preferences\np.get_devices()\nresult={'t':p.compute_device_type,'d':[(d.name,d.use) for d in p.devices]}"}, 3, 'execute')
call('screenshot window (GUI)', 'get_screenshot_of_window_as_image', {'size_limit_in_bytes': 400000}, 3, 'screenshot')
call('thumbnail render (GUI)', 'render_thumbnail_to_path', {'output_path': os.path.join(SCRATCH, 'gui_thumb.png')}, 2, 'render')
call('viewport render (GUI)', 'render_viewport_to_path', {'output_path': os.path.join(SCRATCH, 'gui_render.png')}, 1, 'render')
call('path info (_for_cli)', 'get_blendfile_summary_path_info_for_cli', {'blend_file': BLEND}, 2, 'cli')
call('datablocks (_for_cli)', 'get_blendfile_summary_datablocks_for_cli', {'blend_file': BLEND}, 2, 'cli')
call('execute trivial (_for_cli)', 'execute_blender_code_for_cli', {'blend_file': BLEND, 'code': 'import bpy\nresult={"objs":len(bpy.data.objects),"instances":sum(1 for _ in bpy.context.evaluated_depsgraph_get().object_instances)}'}, 2, 'cli')
proc.stdin.close()
try:
    proc.wait(10)
except Exception:
    proc.kill()
agg = {}
for r in rows:
    agg.setdefault(r['label'], []).append(r['seconds'])
summary = {k: {'n': len(v), 'first_s': v[0], 'median_s': sorted(v)[len(v) // 2], 'max_s': max(v)} for k, v in agg.items()}
json.dump({'server_init_s': round(init_s, 2), 'tools': len(names), 'rows': rows, 'summary': summary}, open(OUTJ, 'w'), indent=1)
print('SUMMARY ' + json.dumps({'server_init_s': round(init_s, 2), 'tools': len(names), 'summary': summary}))
