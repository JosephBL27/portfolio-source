#!/bin/zsh
# Build the public site for a GitHub Pages project path, minus anything that must not be public.
# usage: scripts/deploy/build-pages.sh <name> <outDir>    e.g. portfolio /tmp/pages  ->  https://josephbl27.github.io/portfolio/
set -e
name=$1; out=$2
cd "${0:A:h}/../.."
rm -rf "$out"
npx vite build --base=/$name/ --outDir "$out" >/dev/null
cd "$out"
rm -f v2.html media/thrift/page-10-* media/thrift/page-19-*   # old build; thrift pages that print unverified estimates
find . -name "*.map" -delete
touch .nojekyll
NAME=$name python3 - <<'PY'
import os, re
base = '/' + os.environ['NAME'] + '/'
pat = re.compile(r'''(["'`(])/(media|models|docs|demos|lab)/''')
n = 0
for root, _, fs in os.walk('.'):
    if root.startswith('./demos'): continue          # demos are self-contained builds
    for f in fs:
        if not f.endswith(('.js', '.css', '.html', '.json')): continue
        p = os.path.join(root, f); s = open(p, encoding='utf-8', errors='ignore').read()
        s2, k = pat.subn(lambda m: m.group(1) + base + m.group(2) + '/', s)
        if k: open(p, 'w', encoding='utf-8').write(s2); n += k
print('rewrote', n, 'hard-coded asset paths')
PY
