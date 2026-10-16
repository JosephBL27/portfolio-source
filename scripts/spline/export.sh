#!/bin/bash
# usage: export.sh <namePrefix> <fileKey>   (asks the Spline HTML exporter to dump every object whose name starts with prefix)
before=$(curl -s http://127.0.0.1:5291/log | grep -o "all-done%20$2" | wc -l)
curl -s -X POST -d "{\"prefix\":\"$1\",\"key\":\"$2\"}" http://127.0.0.1:5291/setcmd >/dev/null
for i in $(seq 1 60); do sleep 0.5; now=$(curl -s http://127.0.0.1:5291/log | grep -o "all-done%20$2" | wc -l); if [ "$now" -gt "$before" ]; then echo done; break; fi; done
curl -s http://127.0.0.1:5291/log | python3 -c "import json,sys; l=json.load(sys.stdin); print([x['ping'] for x in l if 'ping' in x][-2:])"
