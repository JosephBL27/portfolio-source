#!/usr/bin/env -S python3 -B -I
"""ambientCG (CC0) shared asset cache: the same rules as polyhaven_fetch.py, for the PBR materials the scripts read.

Cache: ~/AgentRuntime/assets/ambientcg/<AssetId>/   e.g. Rock064/Rock064_1K-JPG.zip + Rock064/1K-JPG/<maps>.jpg + asset.json
Rule:  download into <AssetId>.partial/, check the byte size against the API, extract ONLY the .jpg/.png maps (never the .blend / .usdc / .mtlx the zips
       also carry: a downloaded .blend must never be opened with autoexec), write asset.json (sha256, size, url) last, then rename.
       Several resolutions of one asset sit side by side (1K-JPG next to 2K-JPG). Normals: NormalGL (Blender / glTF); NormalDX is not extracted.
Index: ~/AgentRuntime/assets/ambientcg/manifest.json, rebuilt from asset.json files on every run.

Usage:
  python3 -B -I ambientcg_fetch.py fetch Rock064 1K-JPG            # API v2 -> zip -> maps (needs the ambientCG download host to resolve)
  python3 -B -I ambientcg_fetch.py adopt Metal009 1K-JPG <zip>     # a zip already on disk (another agent's scratch copy): same checks, no network for the file
  python3 -B -I ambientcg_fetch.py verify                          # re-hash every recorded file
  python3 -B -I ambientcg_fetch.py manifest
API: https://ambientcg.com/api/v2/full_json?id=<id>&include=downloadData (no key). Licence CC0 1.0.
"""
import hashlib, json, os, shutil, sys, time, urllib.request, zipfile

ROOT = os.path.expanduser('~/AgentRuntime/assets/ambientcg')
UA = {'User-Agent': 'joseph-portfolio-agent/1.0 (ambientcg_fetch.py)'}
MAP_EXT = ('.jpg', '.jpeg', '.png')
SKIP = ('NormalDX',)
STALE_PARTIAL_S = 600


def info(asset_id):
    url = f'https://ambientcg.com/api/v2/full_json?id={asset_id}&include=downloadData'
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        d = json.load(r)
    found = [a for a in d.get('foundAssets', []) if a['assetId'] == asset_id]
    if not found:
        raise RuntimeError(f'{asset_id}: not found on ambientCG')
    a = found[0]
    dl = {x['attribute']: x for x in a['downloadFolders']['default']['downloadFiletypeCategories']['zip']['downloads']}
    return a, dl


def sha256_of(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def finish(asset_id, attr, zip_src, how, a, dl_entry):
    """how: 'downloaded' (the zip is ours, moved in) or 'adopted' (another agent's zip, copied)"""
    final = os.path.join(ROOT, asset_id)
    partial = final + '.partial'
    if os.path.isdir(partial):
        if time.time() - os.path.getmtime(partial) < STALE_PARTIAL_S:
            return {'asset': asset_id, 'attr': attr, 'status': 'busy (another agent .partial)'}
        shutil.rmtree(partial)
    os.makedirs(partial)
    try:
        zname = f'{asset_id}_{attr}.zip'
        zdst = os.path.join(partial, zname)
        (shutil.move if how == 'downloaded' else shutil.copy2)(zip_src, zdst)
        size = os.path.getsize(zdst)
        if size != dl_entry['size']:
            raise RuntimeError(f'size {size} != API {dl_entry["size"]}')
        maps = []
        os.makedirs(os.path.join(partial, attr))
        with zipfile.ZipFile(zdst) as z:
            for n in z.namelist():
                base = os.path.basename(n)  # flat names only: no path from the archive is ever used
                if not base.lower().endswith(MAP_EXT) or any(s in base for s in SKIP) or base.startswith('.'):
                    continue
                out = os.path.join(partial, attr, base)
                with z.open(n) as src, open(out, 'wb') as dst:
                    shutil.copyfileobj(src, dst)
                maps.append({'path': f'{attr}/{base}', 'bytes': os.path.getsize(out), 'sha256': sha256_of(out)})
        entry = {'path': zname, 'bytes': size, 'sha256': sha256_of(zdst), 'url': dl_entry['fullDownloadPath'], 'attr': attr}
        doc = {'id': asset_id, 'name': a.get('displayName'), 'licence': 'CC0', 'url': f'https://ambientcg.com/a/{asset_id}', 'files': [], 'attrs': []}
        old = os.path.join(final, 'asset.json')
        if os.path.exists(old):  # add a resolution beside the ones already there
            doc = json.load(open(old))
            for f in list(doc['files']):
                if f['path'].startswith(attr + '/') or f['path'] == zname:
                    doc['files'].remove(f)
            os.replace(os.path.join(partial, zname), os.path.join(final, zname))
            if os.path.isdir(os.path.join(final, attr)):
                shutil.rmtree(os.path.join(final, attr))
            shutil.move(os.path.join(partial, attr), os.path.join(final, attr))
            shutil.rmtree(partial)
            target = final
        else:
            target = partial
        doc['files'] += [entry] + maps
        doc['attrs'] = sorted(set(doc.get('attrs', [])) | {attr})
        doc['bytes'] = sum(f['bytes'] for f in doc['files'])
        doc['fetched'] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
        json.dump(doc, open(os.path.join(target, 'asset.json'), 'w'), indent=1)
        if target == partial:
            os.rename(partial, final)
    except Exception:
        shutil.rmtree(partial, ignore_errors=True)
        raise
    return {'asset': asset_id, 'attr': attr, 'status': how, 'maps': len(maps), 'bytes': size}


def fetch(asset_id, attr):
    a, dl = info(asset_id)
    e = dl[attr]
    tmp = os.path.join(ROOT, f'.dl-{asset_id}-{attr}.zip')
    os.makedirs(ROOT, exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(e['fullDownloadPath'], headers=UA), timeout=120) as r, open(tmp, 'wb') as f:
        shutil.copyfileobj(r, f, 1 << 20)
    return finish(asset_id, attr, tmp, 'downloaded', a, e)


def adopt(asset_id, attr, zip_path):
    a, dl = info(asset_id)
    return finish(asset_id, attr, os.path.abspath(zip_path), 'adopted', a, dl[attr])


def manifest():
    assets = []
    for d in sorted(os.listdir(ROOT)) if os.path.isdir(ROOT) else []:
        m = os.path.join(ROOT, d, 'asset.json')
        if d.endswith('.partial') or not os.path.exists(m):
            continue
        a = json.load(open(m))
        assets.append({'id': a['id'], 'name': a.get('name'), 'attrs': a['attrs'], 'licence': 'CC0', 'url': a['url'], 'bytes': a['bytes'],
                       'maps': [f['path'] for f in a['files'] if not f['path'].endswith('.zip')]})
    out = {'generated': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'source': 'ambientcg.com api v2', 'licence': 'CC0', 'root': ROOT,
           'total_bytes': sum(x['bytes'] for x in assets), 'assets': assets}
    json.dump(out, open(os.path.join(ROOT, 'manifest.json'), 'w'), indent=1)
    return out


def verify():
    bad, ok = [], 0
    for d in sorted(os.listdir(ROOT)):
        m = os.path.join(ROOT, d, 'asset.json')
        if d.endswith('.partial') or not os.path.exists(m):
            continue
        for f in json.load(open(m))['files']:
            p = os.path.join(ROOT, d, f['path'])
            if not os.path.exists(p) or os.path.getsize(p) != f['bytes'] or sha256_of(p) != f['sha256']:
                bad.append((d, f['path']))
            else:
                ok += 1
    print(json.dumps({'files_ok': ok, 'bad': bad}))
    return 1 if bad else 0


def main(argv):
    os.makedirs(ROOT, exist_ok=True)
    cmd = argv[0] if argv else 'manifest'
    if cmd == 'verify':
        return verify()
    if cmd == 'fetch':
        r = fetch(argv[1], argv[2])
    elif cmd == 'adopt':
        r = adopt(argv[1], argv[2], argv[3])
    elif cmd == 'manifest':
        r = {'assets': len(manifest()['assets'])}
        print(json.dumps(r))
        return 0
    else:
        print(__doc__)
        return 2
    print(json.dumps(r))
    manifest()
    return 0 if r['status'] in ('adopted', 'downloaded') else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
