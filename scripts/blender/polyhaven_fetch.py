#!/usr/bin/env -S python3 -B -I
"""Poly Haven (CC0) shared asset cache fetcher.

Cache: ~/AgentRuntime/assets/polyhaven/<slug>/   (one directory per asset, shared by every agent; several resolutions of one
       asset live side by side in that directory: file names carry the resolution, e.g. fir_tree_01_1k.blend + fir_tree_01_2k.blend)
Rule:  download into <slug>.partial/, verify md5, then merge into <slug>/ (a new asset is a single rename). Two agents never half-write one
       asset: a <slug>.partial younger than 10 minutes belongs to another agent and is skipped this pass (re-run later).
       asset.json is the commit marker and is written last.
Index: ~/AgentRuntime/assets/polyhaven/manifest.json (slug, kind, resolutions, files, bytes, licence CC0, url), re-merged on every run.
       Entries added by hand by another agent (a directory without asset.json) are carried forward, flagged "unverified".
Never in the cache: Blender's generated .tx files. They go to ~/AgentRuntime/cache/blender-tx (m5_preset.apply_prefs sets it); a
       `blender_tx` folder found in an asset directory is derived data and `clean` deletes it.

Usage (always `python3 -B -I`: no bytecode, no user site):
  python3 -B -I polyhaven_fetch.py model fir_tree_01 2k          # .blend + its png textures at 2k (adds to a 1k already there)
  python3 -B -I polyhaven_fetch.py texture rocky_terrain 4k      # diff / nor_gl / arm / disp, jpg
  python3 -B -I polyhaven_fetch.py hdri forest_slope 4k          # .exr
  python3 -B -I polyhaven_fetch.py plan library                  # dry run: bytes to download per job, disk free (no writes)
  python3 -B -I polyhaven_fetch.py library [skip-slug ...]       # Joseph's guide section 2 library at the guide's resolutions
  python3 -B -I polyhaven_fetch.py pack alpine|ruins|desert|city # a world pack at 2K textures + 4K HDRI;  `packs` = all four
  python3 -B -I polyhaven_fetch.py starter                       # the guide's "fastest first project" (Fir Tree 01, Fern 02, Rock Moss Set 01, Forest Ground 01, Forest Slope)
  python3 -B -I polyhaven_fetch.py all                           # library + packs, deduplicated
  python3 -B -I polyhaven_fetch.py adopt hdri old_hall 8k <file>  # a file already on disk (outside the cache): md5 + size must equal the API's, then it is filed like a download
  python3 -B -I polyhaven_fetch.py verify                        # re-hash every recorded file against asset.json, report missing / stray
  python3 -B -I polyhaven_fetch.py clean                         # delete derived blender_tx folders inside asset directories
  python3 -B -I polyhaven_fetch.py manifest                      # rebuild manifest.json from disk only
Normals are always nor_gl (Blender / glTF convention). API: https://api.polyhaven.com (no key; CC0).

Slug traps (Poly Haven spells them differently from the display names Joseph's guide uses; ALIASES maps them, with a note):
  "Forest Ground 01"  = forrest_ground_01   (two r; forest_ground_01 is a 404)
  "Pfalzer Forest 01" = phalzer_forest_01   ("Pfaelzer", no f-a-l-z-e-r)
"""
import hashlib, json, os, shutil, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.expanduser('~/AgentRuntime/assets/polyhaven')
API = 'https://api.polyhaven.com'
UA = {'User-Agent': 'joseph-portfolio-agent/1.0 (polyhaven_fetch.py)'}
STALE_PARTIAL_S = 600
MIN_FREE_GB = 25  # refuse to start a job set that would leave less than this free

ALIASES = {  # guide name (slugified) -> real Poly Haven slug
    'forest_ground_01': 'forrest_ground_01',
    'pfalzer_forest_01': 'phalzer_forest_01',
}

# (kind, slug, resolution).  Joseph's M5 guide section 2, at the guide's resolutions:
#   models 1K-2K (LOD collections come with the .blend); terrain textures 4K where the guide says 4K, else 2K; HDRIs 4K .exr.
LIBRARY = [
    ('model', 'fir_tree_01', '1k'),            # guide: use LODs, lower-res textures (the alpine pack adds 2k)
    ('model', 'pine_tree_01', '1k'),
    ('model', 'pine_sapling_medium', '1k'),
    ('model', 'fern_02', '2k'),
    ('model', 'rock_moss_set_01', '2k'),
    ('model', 'mountainside', '2k'),
    ('texture', 'forrest_ground_01', '4k'),    # "Forest Ground 01 (4K)"
    ('texture', 'forest_ground_04', '2k'),     # "2K-4K": 2k
    ('texture', 'rocky_terrain', '4k'),
    ('texture', 'rock_surface', '4k'),
    ('texture', 'rock_face', '4k'),
    ('texture', 'aerial_rocks_04', '2k'),      # "2K-4K": 2k
    ('hdri', 'sunset_forest', '4k'),
    ('hdri', 'forest_slope', '4k'),
    ('hdri', 'phalzer_forest_01', '4k'),       # "Pfalzer Forest 01 (2K-4K)": 4k, the guide says start with 4K .exr
]
STARTER = [  # the guide's "fastest first project"
    ('hdri', 'forest_slope', '4k'),
    ('model', 'fir_tree_01', '1k'),
    ('model', 'fern_02', '2k'),
    ('model', 'rock_moss_set_01', '2k'),
    ('texture', 'forrest_ground_01', '4k'),
]
PACKS = {  # world packs: 2K textures, 4K HDRIs. Not on Poly Haven: GScatter / BlenderKit architecture (accounts), procedural sky (built into Blender).
    'alpine': [('model', 'fir_tree_01', '2k'), ('model', 'fern_02', '2k'), ('model', 'grass_medium_02', '2k'),
               ('model', 'rock_moss_set_01', '2k'), ('hdri', 'forest_slope', '4k')],
    'ruins': [('texture', 'defense_wall', '2k'), ('texture', 'broken_wall', '2k'), ('texture', 'brick_moss_001', '2k'),
              ('hdri', 'overcast_soil_puresky', '4k')],             # the guide's "overcast HDRI" is not a name: overcast_soil_puresky is the most-downloaded overcast pure sky (351k downloads, API 2026-10-12; kloofendal_overcast_puresky 104k)
    'desert': [('texture', 'sand_01', '2k'), ('texture', 'dry_ground_01', '2k'), ('texture', 'cliff_side', '2k')],  # sky: Blender's procedural sky, low sun
    'city': [('texture', 'asphalt_01', '2k'), ('texture', 'concrete_floor', '2k'), ('texture', 'brick_wall_04', '2k'),
             ('hdri', 'vignaioli_night', '4k')],
}


def jobs_for(name):
    if name == 'starter':
        return list(STARTER)
    if name == 'library':
        return list(LIBRARY)
    if name == 'packs':
        return [j for p in PACKS.values() for j in p]
    if name == 'all':
        seen, out = set(), []
        for j in LIBRARY + jobs_for('packs'):
            if j not in seen:
                seen.add(j)
                out.append(j)
        return out
    if name == 'pack':
        raise ValueError('pack needs a name: ' + ', '.join(PACKS))
    raise ValueError(name)


def res_key(r):
    return int(r[:-1])


def api(path):
    last = None
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=40) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f'API {path}: {last!r}')


def md5_of(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def fetch_file(url, dest, md5, size):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(3):
        try:
            tmp = dest + '.dl'
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(tmp, 'wb') as f:
                shutil.copyfileobj(r, f, 1 << 20)
            if md5 and md5_of(tmp) != md5:
                raise RuntimeError('md5 mismatch ' + url)
            os.replace(tmp, dest)
            return os.path.getsize(dest)
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                raise RuntimeError(f'{url}: {e!r}')
            time.sleep(2 * (attempt + 1))


def plan_model(slug, res):
    f = api(f'/files/{slug}')['blend']
    if res not in f:
        raise RuntimeError(f'{slug}: no {res}; have {list(f)}')
    b = f[res]['blend']
    items = [(f'{slug}_{res}.blend', b)]
    items += [(k, v) for k, v in b['include'].items()]  # keys are relative paths like textures/<file>.png
    return items


def plan_texture(slug, res):
    f = api(f'/files/{slug}')
    items = []
    for m, tag in (('Diffuse', 'diff'), ('nor_gl', 'nor_gl'), ('arm', 'arm'), ('Displacement', 'disp')):
        if m in f and res in f[m] and 'jpg' in f[m][res]:
            items.append((f'{slug}_{tag}_{res}.jpg', f[m][res]['jpg']))
    if not items:
        raise RuntimeError(f'{slug}: no jpg maps at {res}')
    return items


def plan_hdri(slug, res):
    h = api(f'/files/{slug}')['hdri']
    if res not in h or 'exr' not in h[res]:
        raise RuntimeError(f'{slug}: no {res} exr; have {list(h)}')
    return [(f'{slug}_{res}.exr', h[res]['exr'])]


PLANNERS = {'model': plan_model, 'texture': plan_texture, 'hdri': plan_hdri}


def load_doc(slug):
    meta = os.path.join(ROOT, slug, 'asset.json')
    if not os.path.exists(meta):
        return None
    d = json.load(open(meta))
    if 'resolutions' not in d:  # legacy single-resolution record
        d['resolutions'] = [d['resolution']]
        for f in d['files']:
            f.setdefault('res', d['resolution'])
    return d


def get_asset(kind, slug, res, dry=False):
    final = os.path.join(ROOT, slug)
    partial = final + '.partial'
    doc = load_doc(slug)
    if doc and res in doc['resolutions']:
        return {'slug': slug, 'res': res, 'status': 'cached', 'bytes': sum(f['bytes'] for f in doc['files'] if f.get('res') == res)}
    if os.path.isdir(final) and not doc:
        return {'slug': slug, 'res': res, 'status': 'SKIPPED: directory exists without asset.json (added by hand by another agent); not overwriting'}
    items = PLANNERS[kind](slug, res)
    if dry:
        return {'slug': slug, 'res': res, 'status': 'would download', 'bytes': sum(e.get('size') or 0 for _, e in items), 'files': len(items)}
    if os.path.isdir(partial):
        age = time.time() - os.path.getmtime(partial)
        if age < STALE_PARTIAL_S:
            return {'slug': slug, 'res': res, 'status': 'busy (another agent .partial, %ds old)' % age}
        shutil.rmtree(partial)
    os.makedirs(partial)
    t0 = time.time()
    info = api(f'/info/{slug}')

    def one(it):
        name, e = it
        n = fetch_file(e['url'], os.path.join(partial, name), e.get('md5'), e.get('size'))
        os.utime(partial)  # keep the partial fresh so other agents see it is alive
        return {'path': name, 'bytes': n, 'md5': e.get('md5'), 'url': e['url'], 'res': res}
    try:
        with ThreadPoolExecutor(max_workers=3) as ex:
            out = list(ex.map(one, items))
    except Exception:
        shutil.rmtree(partial, ignore_errors=True)  # we created this partial a moment ago and hold the claim: free it so the retry is not "busy"
        raise
    total = sum(o['bytes'] for o in out)
    now = time.strftime('%Y-%m-%dT%H:%M:%S%z')
    if doc is None:
        new = {'slug': slug, 'kind': kind, 'name': info.get('name'), 'resolution': res, 'resolutions': [res], 'licence': 'CC0',
               'url': f'https://polyhaven.com/a/{slug}', 'authors': info.get('authors'), 'files': out, 'bytes': total,
               'fetched': now, 'seconds': round(time.time() - t0, 1)}
        json.dump(new, open(os.path.join(partial, 'asset.json'), 'w'), indent=1)
        os.rename(partial, final)
    else:  # add one more resolution beside the ones already there; asset.json is replaced last
        for o in out:
            dest = os.path.join(final, o['path'])
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            os.replace(os.path.join(partial, o['path']), dest)
        doc['files'] = [f for f in doc['files'] if f['path'] not in {o['path'] for o in out}] + out
        doc['resolutions'] = sorted(set(doc['resolutions']) | {res}, key=res_key)
        doc['resolution'] = doc['resolutions'][-1]
        doc['bytes'] = sum(f['bytes'] for f in doc['files'])
        doc['fetched'] = now
        doc['seconds'] = round(time.time() - t0, 1)
        tmp = os.path.join(final, 'asset.json.tmp')
        json.dump(doc, open(tmp, 'w'), indent=1)
        os.replace(tmp, os.path.join(final, 'asset.json'))
        shutil.rmtree(partial)
    return {'slug': slug, 'res': res, 'status': 'downloaded', 'bytes': total, 'seconds': round(time.time() - t0, 1)}


def adopt(kind, slug, res, src):
    """File a single already-downloaded hdri/texture file (found outside the cache, e.g. ~/.cache/portfolio-hall/old-hall/old_hall_8k.hdr) into the cache
    WITHOUT downloading it again: the API's md5 and size for that exact file must match, else nothing is written. Only hdri is supported (one file per
    resolution and format); models and textures come from get_asset()."""
    if kind != 'hdri':
        raise ValueError('adopt supports hdri only')
    ext = os.path.splitext(src)[1].lstrip('.').lower()
    ent = api(f'/files/{slug}')['hdri'].get(res, {}).get(ext)
    if not ent:
        raise RuntimeError(f'{slug}: the API lists no {res} .{ext}')
    size, md5 = os.path.getsize(src), md5_of(src)
    if size != ent['size'] or md5 != ent['md5']:
        raise RuntimeError(f'{src}: size {size} md5 {md5} do not match the API ({ent["size"]} {ent["md5"]}); not adopting')
    final = os.path.join(ROOT, slug)
    partial = final + '.partial'
    doc = load_doc(slug)
    name = f'{slug}_{res}.{ext}'
    if doc and name in {f['path'] for f in doc['files']}:
        return {'slug': slug, 'res': res, 'status': 'cached', 'bytes': size}
    if os.path.isdir(final) and not doc:
        return {'slug': slug, 'res': res, 'status': 'SKIPPED: directory exists without asset.json; not overwriting'}
    if os.path.isdir(partial):
        if time.time() - os.path.getmtime(partial) < STALE_PARTIAL_S:
            return {'slug': slug, 'res': res, 'status': 'busy (another agent .partial)'}
        shutil.rmtree(partial)
    os.makedirs(partial)
    try:
        shutil.copy2(src, os.path.join(partial, name))
        if md5_of(os.path.join(partial, name)) != md5:
            raise RuntimeError('copy changed the file')
        info = api(f'/info/{slug}')
        now = time.strftime('%Y-%m-%dT%H:%M:%S%z')
        entry = {'path': name, 'bytes': size, 'md5': md5, 'url': ent['url'], 'res': res, 'adopted_from': src}
        if doc is None:
            new = {'slug': slug, 'kind': kind, 'name': info.get('name'), 'resolution': res, 'resolutions': [res], 'licence': 'CC0',
                   'url': f'https://polyhaven.com/a/{slug}', 'authors': info.get('authors'), 'files': [entry], 'bytes': size, 'fetched': now, 'seconds': 0}
            json.dump(new, open(os.path.join(partial, 'asset.json'), 'w'), indent=1)
            os.rename(partial, final)
        else:
            os.replace(os.path.join(partial, name), os.path.join(final, name))
            doc['files'] = [f for f in doc['files'] if f['path'] != name] + [entry]
            doc['resolutions'] = sorted(set(doc['resolutions']) | {res}, key=res_key)
            doc['resolution'] = doc['resolutions'][-1]
            doc['bytes'] = sum(f['bytes'] for f in doc['files'])
            doc['fetched'] = now
            tmp = os.path.join(final, 'asset.json.tmp')
            json.dump(doc, open(tmp, 'w'), indent=1)
            os.replace(tmp, os.path.join(final, 'asset.json'))
            shutil.rmtree(partial)
    except Exception:
        shutil.rmtree(partial, ignore_errors=True)
        raise
    build_manifest()
    return {'slug': slug, 'res': res, 'status': 'adopted', 'bytes': size}


def build_manifest():
    assets, prev = [], {}
    mp = os.path.join(ROOT, 'manifest.json')
    if os.path.exists(mp):
        prev = {a['slug']: a for a in json.load(open(mp)).get('assets', [])}
    seen = set()
    for d in sorted(os.listdir(ROOT)):
        p = os.path.join(ROOT, d)
        if d.endswith('.partial') or not os.path.isdir(p):
            continue
        doc = load_doc(d)
        if doc is None:  # added by hand by another agent: keep its previous manifest entry, flagged
            if d in prev:
                e = dict(prev[d])
                e['unverified'] = 'no asset.json (added by hand); md5 not recorded'
                assets.append(e)
                seen.add(d)
            continue
        assets.append({'slug': doc['slug'], 'kind': doc['kind'], 'name': doc.get('name'), 'resolution': doc['resolution'],
                       'resolutions': doc['resolutions'], 'licence': 'CC0', 'url': doc['url'], 'authors': doc.get('authors'),
                       'bytes': doc['bytes'], 'files': [{'path': f['path'], 'bytes': f['bytes'], 'res': f.get('res')} for f in doc['files']]})
        seen.add(d)
    out = {'generated': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'source': 'api.polyhaven.com', 'licence': 'CC0', 'root': ROOT,
           'total_bytes': sum(a['bytes'] for a in assets), 'assets': assets}
    tmp = os.path.join(ROOT, 'manifest.json.tmp')
    json.dump(out, open(tmp, 'w'), indent=1)
    os.replace(tmp, mp)
    return out


def verify():
    bad, ok, unverified, stray = [], 0, [], []
    for d in sorted(os.listdir(ROOT)):
        p = os.path.join(ROOT, d)
        if d.endswith('.partial') or not os.path.isdir(p):
            continue
        doc = load_doc(d)
        if doc is None:
            unverified.append(d)
            continue
        known = {f['path'] for f in doc['files']} | {'asset.json'}
        for f in doc['files']:
            fp = os.path.join(p, f['path'])
            if not os.path.exists(fp):
                bad.append((d, f['path'], 'missing'))
            elif os.path.getsize(fp) != f['bytes']:
                bad.append((d, f['path'], 'size'))
            elif f.get('md5') and md5_of(fp) != f['md5']:
                bad.append((d, f['path'], 'md5'))
            else:
                ok += 1
        for dp, dn, fn in os.walk(p):
            if os.path.basename(dp) == 'blender_tx':
                stray.append(os.path.relpath(dp, ROOT))
                dn[:] = []
                continue
            for n in fn:
                rel = os.path.relpath(os.path.join(dp, n), p)
                if rel not in known and not n.endswith('.dl'):
                    stray.append(os.path.join(d, rel))
    r = {'files_ok': ok, 'bad': bad, 'unverified_dirs': unverified, 'stray': stray}
    print(json.dumps(r, indent=1))
    return 1 if bad else 0


def clean():
    n = 0
    for dp, dn, fn in os.walk(ROOT):
        if os.path.basename(dp) == 'blender_tx':
            sz = sum(os.path.getsize(os.path.join(dp, f)) for f in fn)
            shutil.rmtree(dp)
            print(json.dumps({'removed': os.path.relpath(dp, ROOT), 'bytes': sz}))
            n += 1
            dn[:] = []
    print(json.dumps({'blender_tx_dirs_removed': n}))
    return 0


def free_gb():
    st = os.statvfs(ROOT)
    return st.f_bavail * st.f_frsize / 1e9


def run_jobs(jobs, dry=False):
    rc, todo = 0, 0
    for kind, slug, res in jobs:
        slug = ALIASES.get(slug, slug)
        if not dry and free_gb() < MIN_FREE_GB:
            print(json.dumps({'slug': slug, 'status': 'STOPPED: free disk below %d GB' % MIN_FREE_GB}))
            return 1
        try:
            r = get_asset(kind, slug, res, dry=dry)
        except Exception as e:  # noqa: BLE001
            r = {'slug': slug, 'res': res, 'status': 'FAILED', 'error': repr(e)}
            rc = 1
        todo += r.get('bytes', 0) if r['status'] == 'would download' else 0
        print(json.dumps(r), flush=True)
        if not dry:
            build_manifest()
    if dry:
        print(json.dumps({'to_download_bytes': todo, 'to_download_mb': round(todo / 1e6), 'free_gb': round(free_gb(), 1)}))
    return rc


def main(argv):
    os.makedirs(ROOT, exist_ok=True)
    if not argv or argv[0] == 'manifest':
        d = build_manifest()
        print(json.dumps({'assets': len(d['assets']), 'total_bytes': d['total_bytes']}))
        return 0
    cmd = argv[0]
    if cmd == 'verify':
        return verify()
    if cmd == 'clean':
        return clean()
    if cmd == 'adopt':
        print(json.dumps(adopt(*argv[1:5])))
        return 0
    dry = cmd == 'plan'
    if dry:
        argv = argv[1:]
        cmd = argv[0]
    if cmd == 'pack':
        jobs = PACKS[argv[1]]
    elif cmd in ('starter', 'library', 'packs', 'all'):
        jobs = jobs_for(cmd)
        skip = set(argv[1:])
        jobs = [j for j in jobs if j[1] not in skip]
    elif cmd in PLANNERS:
        jobs = [(cmd, argv[1], argv[2])]
    else:
        print(__doc__)
        return 2
    return run_jobs(jobs, dry=dry)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
