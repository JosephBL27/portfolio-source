"""Joseph's Apple M5 (24 GB shared memory) Cycles presets for Blender 5.2.

    apply(scene, mode)   mode in 'world' | 'lookdev' | 'final'  ->  dict read back from the scene
    apply_bake(scene)    the same device + light-path values for BAKES (AO vertex colour, lightmaps): no adaptive, no denoise, Standard view
    apply_prefs()        Metal backend, M5 GPU on, CPU off, MetalRT Auto, texture cache dir (re-asserted per process; the saved prefs already hold them)
    configure_device()   strict device switch for any script: GPU raises when Metal is missing, CPU only when asked (arg or M5_DEVICE=cpu)
    CLI (headless):
        Blender -b file.blend -P m5_preset.py -- --mode lookdev [--save out.blend] [--scene NAME]
                [--samples N] [--percent N] [--gpu-denoise] [--tx-dir DIR] [--no-prefs] [--quiet]
      Applies the preset to the scene and prints one line "M5_PRESET {json}".  Without --save nothing is written.
      --save writes a COPY (save_as_mainfile copy=True); the source file is never overwritten.
      --res guide | WxH   output size (guide = 2560x1440, the size Joseph's guide gives for finals; look-dev is the same canvas at 75 %)
    Run another script after it in the same process:  Blender -b f.blend -P m5_preset.py -- --mode final -P render.py
    Never pass --factory-startup to a script that does not set the device itself: it drops the saved Metal prefs and Cycles then renders on the CPU.
    (Every script here sets the device through this module or its own try-block; read_prefs.py shows what a plain `Blender -b` loads.)
    Python bytecode: Blender ignores PYTHONDONTWRITEBYTECODE unless --python-use-system-env is given (verified 2026-10-12), so scripts that import a
    sibling module set sys.dont_write_bytecode = True first, and run_retry.sh / m5_bench.py pass the flag. __pycache__ is git-ignored.

Value provenance ("J" = Joseph's exact value from BRIEF-R5, "A" = chosen here, because he gave none; override on the CLI):
    J  Cycles, Metal GPU, MetalRT Auto, adaptive sampling on, noise threshold 0.03, total bounces 5, volume bounces 1,
       denoising on, tile 1024 px, Persistent Data off, AgX, Texture Cache + Auto Generate on,
       look-dev: max samples 64, resolution 75 %, Simplify on (textures 2K);  final: resolution 100 %, textures 2K-4K (Simplify off).
    J  viewport subdivision 1 in every mode (the guide: "Viewport subdivision 0-1"; it was 2 in look-dev and final until 2026-10-12; it only affects the GUI viewport);
    A  world mode (layout / blocking: 32 samples, 50 %, Simplify with 1K textures and camera culling);
       final samples 256 (adaptive stops at the 0.03 threshold long before this on most shots);
       Simplify subdivision / child-particle / volume factors.
PREFERENCES vs PER-SCENE (Joseph's guide section 5, read back from the 5.2.2 API 2026-10-12):
    preferences (userpref.blend; set once from the GUI side and saved, so his next quit cannot undo them; apply_prefs() re-asserts them per process):
        System > Cycles Render Devices = Metal, Apple M5 GPU on, CPU off, MetalRT Auto; System > Allow Online Access on;
        File Paths > Texture Cache directory = ~/AgentRuntime/cache/blender-tx (saved 2026-10-12: blank puts .tx files in a `blender_tx` folder next to every
        downloaded image, which polluted the shared asset cache); Performance preset = default (nothing to set); Memory cache limit 4096 (default).
    per scene (apply() sets all of these and reads them back):
        engine, device GPU, samples + noise threshold + adaptive, denoise, total + volume bounces, tile size, Persistent Data off, Texture Cache + Auto Generate,
        Simplify + texture limit (the guide's "texture resolution 2K-4K"; cycles.texture_resolution is only a scale factor and stays 1.0), resolution
        (percentage here, the 2560x1440 canvas via res=), View Transform AgX.
    the guide's "5.2 default cache tile 2048; 1024 or 512 helps memory pressure" is the manual's Memory > Tile Size text (render/cycles/render_settings/performance.rst),
        i.e. cycles.tile_size (5.2 default 2048; 1024 here). There is no separate texture-cache tile property (bl_rna of render, cycles, preferences.system and
        filepaths checked). The 2026-10-12 benchmark showed tile 256/512/1024 do not change device memory on Metal.

COLOUR RULE (the one place it is written; docs/toolchain/blender-3d-stack.md section 12 points here):
    1. A STILL Joseph looks at (look-dev, finals, proofs, thumbnails): View Transform AgX. That is the preset.
    2. Anything that becomes WEB DATA is display-referred and never goes through AgX, because the site's post stack writes colour with no transfer
       function (src/v3/engine/post.ts 23-25; TOOLCHAIN.md calibration blender-gltf):
         - a vertex-colour AO factor (COLOR_0, linear scalar) is written raw: no view transform exists in a bake;
         - baked colour (lightmaps, albedo bakes) is saved as Non-Color after display_curve.shoulder_srgb(): the hue-preserving peak-channel shoulder of
           scripts/hdri-prep.mjs (knee 0.8, roll-off 0.2) then the sRGB OETF; view transform Standard on any preview PNG (apply_bake sets it);
         - an HDRI backdrop goes through scripts/hdri-prep.mjs itself.
       One tone curve, one implementation: display_curve.py (crag_ring.py and hold_field.py import it). hall_photoreal.py keeps its own knee-0.5 copy on
       purpose (the shipped hall is tuned to it: exposure 1.3, HP_VAULT, grade-check); hall_capture.py ships an AgX 'Medium High Contrast' panorama,
       judged by eye in docs/review/hall-rebuild. Both are documented exceptions; a NEW bake follows rule 2.

Blender 5.2 property names (verified in the bundled API docs, never guessed):
    scene.render.use_texture_cache, scene.render.use_auto_generate_texture_cache,
    preferences.filepaths.texture_cache_directory (blank = .tx files next to the images),
    scene.render.use_simplify + simplify_*, scene.cycles.texture_limit / texture_limit_render (only applied while Simplify is on),
    scene.cycles.tile_size, scene.cycles.adaptive_threshold, scene.cycles.max_bounces / volume_bounces,
    preferences.addons['cycles'].preferences.metalrt ('OFF' | 'ON' | 'AUTO').
"""
import json
import sys

import bpy

MODES = {
    # samples, preview_samples, percent, simplify, subdiv(view, render), child particles, volumes, texture limit (view, render), camera cull
    'world':   dict(samples=32,  preview_samples=16, percent=50,  simplify=True,  subdiv=(1, 2), children=0.25, volumes=0.5, tex_view='1024', tex_render='1024', cull=True),
    'lookdev': dict(samples=64,  preview_samples=64, percent=75,  simplify=True,  subdiv=(1, 3), children=0.5,  volumes=0.5, tex_view='1024', tex_render='2048', cull=False),
    'final':   dict(samples=256, preview_samples=128, percent=100, simplify=False, subdiv=(1, 6), children=1.0,  volumes=1.0, tex_view='2048', tex_render='4096', cull=False),
}

FINAL_RES = (2560, 1440)  # J: the guide's "Output 2560x1440, 100% for finals"; look-dev = this canvas at 75 % = 1920x1080
NOISE_THRESHOLD = 0.03   # J
TOTAL_BOUNCES = 5        # J
VOLUME_BOUNCES = 1       # J
TILE_PX = 1024           # J


TX_DIR = '~/AgentRuntime/cache/blender-tx'  # saved in the GUI prefs too (2026-10-12); the dir persists across sessions, .tx files are derived data (safe to delete)


def refresh_devices(cp):
    """Re-scan the Cycles devices. Blender 5.2 renamed CyclesPreferences.get_devices() to refresh_devices() (get_devices is now a deprecated alias that
    just calls it: scripts/addons_core/cycles/properties.py), so use the new name when it exists and fall back for older builds."""
    (getattr(cp, 'refresh_devices', None) or cp.get_devices)()


def apply_prefs(quiet=False, tx_dir=TX_DIR):
    """Metal backend, M5 GPU checked, CPU unchecked, MetalRT Auto. Raises instead of silently falling back to CPU.
    Also points the texture-cache directory at tx_dir for this process ('' = leave as is). Headless Blender never saves prefs, so this does not touch
    userpref.blend; the GUI copy of the same value was saved from the GUI side (see the PREFERENCES table above)."""
    import os
    if tx_dir:
        tx = os.path.expanduser(tx_dir)
        os.makedirs(tx, exist_ok=True)
        bpy.context.preferences.filepaths.texture_cache_directory = tx
    cp = bpy.context.preferences.addons['cycles'].preferences
    cp.compute_device_type = 'METAL'
    refresh_devices(cp)
    for d in cp.devices:
        d.use = d.type == 'METAL'
    cp.metalrt = 'AUTO'
    if not any(d.type == 'METAL' and d.use for d in cp.devices):
        raise RuntimeError('M5 preset: no Metal GPU device available; refusing to fall back to CPU')
    out = {'compute_device_type': cp.compute_device_type, 'metalrt': cp.metalrt,
           'texture_cache_directory': bpy.context.preferences.filepaths.texture_cache_directory,
           'devices': [(d.name, d.type, bool(d.use)) for d in cp.devices]}
    if not quiet:
        print('M5_PREFS ' + json.dumps(out))
    return out


def device_from_env(default='GPU'):
    """'GPU' or 'CPU' from M5_DEVICE (an explicit, visible switch; nothing falls back by itself)."""
    import os
    v = os.environ.get('M5_DEVICE', default).strip().upper()
    if v not in ('GPU', 'CPU'):
        raise ValueError(f'M5_DEVICE must be gpu or cpu, got {v!r}')
    return v


def configure_device(scene, device=None, quiet=True):
    """Strict device switch. device None -> M5_DEVICE or GPU. GPU = apply_prefs() (raises when no Metal device is usable) + scene.cycles.device GPU;
    CPU = compute_device_type NONE + scene.cycles.device CPU. Replaces the try/except blocks that fell back to CPU without anyone noticing."""
    device = device_from_env() if device is None else device.upper()
    scene.render.engine = 'CYCLES'
    if device == 'CPU':
        if not bpy.app.background:  # a GUI session saves its in-memory prefs on quit: never leave Joseph's Metal pref on NONE
            raise RuntimeError('configure_device(CPU) edits the saved Cycles device pref; refusing in a GUI session (use scene.cycles.device = "CPU" yourself)')
        bpy.context.preferences.addons['cycles'].preferences.compute_device_type = 'NONE'
        scene.cycles.device = 'CPU'
        if not quiet:
            print('M5_DEVICE cpu (explicit)')
        return {'device': 'CPU'}
    out = apply_prefs(quiet=quiet)
    scene.cycles.device = 'GPU'
    return {'device': 'GPU', **out}


def apply_bake(scene, samples=64, device=None, bounces=None):
    """Bake settings (AO vertex colours, lightmaps, albedo bakes): the preset's device, tile, Persistent Data off, texture cache; NO adaptive sampling and
    NO denoise (a bake takes neither); View Transform Standard, never AgX (COLOUR RULE 2). bounces None leaves Blender's default (12) so a re-bake of a
    shipped asset reproduces it; pass TOTAL_BOUNCES (5) for a new outdoor bake. Returns a read-back dict."""
    dev = configure_device(scene, device)
    cy, vs = scene.cycles, scene.view_settings
    cy.samples = int(samples)
    cy.use_adaptive_sampling = False
    cy.use_denoising = False
    if bounces is not None:
        cy.max_bounces = int(bounces)
        cy.volume_bounces = VOLUME_BOUNCES
    cy.use_auto_tile = True
    cy.tile_size = TILE_PX
    scene.render.use_persistent_data = False
    scene.render.use_texture_cache = True
    scene.render.use_auto_generate_texture_cache = True
    vs.view_transform = 'Standard'
    return {'bake': True, **dev, 'samples': cy.samples, 'adaptive': cy.use_adaptive_sampling, 'denoising': cy.use_denoising,
            'max_bounces': cy.max_bounces, 'view_transform': vs.view_transform, 'tile_size': cy.tile_size}


def apply(scene, mode='lookdev', samples=None, percent=None, gpu_denoise=False, res=None):
    if mode not in MODES:
        raise ValueError(f'mode must be one of {sorted(MODES)}, got {mode!r}')
    m = MODES[mode]
    r, cy, vs = scene.render, scene.cycles, scene.view_settings

    r.engine = 'CYCLES'
    cy.device = 'GPU'

    # sampling
    cy.samples = int(samples if samples is not None else m['samples'])
    cy.preview_samples = m['preview_samples']
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = NOISE_THRESHOLD
    cy.preview_adaptive_threshold = NOISE_THRESHOLD
    cy.adaptive_min_samples = 0
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_use_gpu = bool(gpu_denoise)  # opt-in: measured -9 % time, -1.1 GB RSS on the M5; quality not yet judged

    # light paths
    cy.max_bounces = TOTAL_BOUNCES
    cy.volume_bounces = VOLUME_BOUNCES

    # tiles and memory
    cy.use_auto_tile = True
    cy.tile_size = TILE_PX
    r.use_persistent_data = False
    r.use_texture_cache = True
    r.use_auto_generate_texture_cache = True

    # resolution
    r.resolution_percentage = int(percent if percent is not None else m['percent'])
    if res is not None:  # (w, h); FINAL_RES is the guide's canvas. Left alone by default so portrait / phone scenes keep their own aspect
        r.resolution_x, r.resolution_y = int(res[0]), int(res[1])

    # colour
    vs.view_transform = 'AgX'

    # Simplify (texture_limit* only applies while Simplify is on)
    r.use_simplify = m['simplify']
    r.simplify_subdivision, r.simplify_subdivision_render = m['subdiv']
    r.simplify_child_particles = r.simplify_child_particles_render = m['children']
    r.simplify_volumes = m['volumes']
    cy.texture_limit = m['tex_view']
    cy.texture_limit_render = m['tex_render']
    cy.use_camera_cull = m['cull']
    return readback(scene, mode)


def readback(scene, mode=None):
    r, cy, vs = scene.render, scene.cycles, scene.view_settings
    cp = bpy.context.preferences.addons['cycles'].preferences
    return {
        'mode': mode, 'engine': r.engine, 'device': cy.device,
        'samples': cy.samples, 'adaptive': cy.use_adaptive_sampling, 'threshold': round(cy.adaptive_threshold, 4),
        'denoising': cy.use_denoising, 'denoiser': cy.denoiser, 'denoise_gpu': cy.denoising_use_gpu,
        'max_bounces': cy.max_bounces, 'volume_bounces': cy.volume_bounces,
        'tile_size': cy.tile_size, 'auto_tile': cy.use_auto_tile, 'persistent_data': r.use_persistent_data,
        'texture_cache': r.use_texture_cache, 'auto_generate_texture_cache': r.use_auto_generate_texture_cache,
        'percent': r.resolution_percentage, 'res': [r.resolution_x, r.resolution_y],
        'view_transform': vs.view_transform,
        'simplify': r.use_simplify, 'simplify_subdivision_render': r.simplify_subdivision_render,
        'texture_limit_render': cy.texture_limit_render, 'camera_cull': cy.use_camera_cull,
        'prefs': {'compute_device_type': cp.compute_device_type, 'metalrt': cp.metalrt,
                  'gpu_on': any(d.type == 'METAL' and d.use for d in cp.devices)},
    }


def main(argv):
    import argparse
    p = argparse.ArgumentParser(prog='m5_preset.py')
    p.add_argument('--mode', choices=sorted(MODES), default='lookdev')
    p.add_argument('--scene')
    p.add_argument('--samples', type=int)
    p.add_argument('--percent', type=int)
    p.add_argument('--save', help='write a copy of the blend here (never the source file)')
    p.add_argument('--tx-dir', default=TX_DIR, help="session-only texture cache dir for .tx files ('' keeps the saved pref)")
    p.add_argument('--no-prefs', action='store_true', help='skip apply_prefs() (use the saved user preferences as they are)')
    p.add_argument('--gpu-denoise', action='store_true', help='run OIDN on the GPU (faster, about 1 GB less RAM; opt-in)')
    p.add_argument('--res', help="output size: 'guide' (2560x1440) or WxH; default leaves the scene's own size")
    p.add_argument('--quiet', action='store_true')
    a = p.parse_args(argv)
    if not a.no_prefs:
        apply_prefs(quiet=a.quiet, tx_dir=a.tx_dir)
    sc = bpy.data.scenes[a.scene] if a.scene else bpy.context.scene
    res = None
    if a.res:
        res = FINAL_RES if a.res == 'guide' else tuple(int(x) for x in a.res.lower().split('x'))
    rb = apply(sc, a.mode, a.samples, a.percent, a.gpu_denoise, res=res)
    if a.save:
        bpy.ops.wm.save_as_mainfile(filepath=a.save, copy=True)
        rb['saved_copy'] = a.save
    print('M5_PRESET ' + json.dumps(rb))
    return rb


if __name__ == '__main__':  # `-P m5_preset.py -- ...` runs as __main__; `import m5_preset` does not
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
