#!/bin/zsh
# Kill headless "Google Chrome for Testing" processes left behind by Playwright scripts.
# Earlier, ~40 orphaned helpers (~600 MB each) filled 24 GB of RAM plus 20 GB of swap and froze the Mac.
# usage: scripts/reap-browsers.sh [max_age_minutes=10]   (0 = kill all)
max=${1:-10}
now=$(date +%s); n=0
for pid in $(pgrep -f "Google Chrome for Testing.app/Contents"); do
  start=$(ps -o lstart= -p $pid 2>/dev/null) || continue
  age=$(( (now - $(date -j -f "%a %b %d %T %Y" "$start" +%s)) / 60 ))
  if (( age >= max )); then kill $pid 2>/dev/null && n=$((n+1)); fi
done
echo "reaped $n headless Chrome processes (older than ${max} min); left: $(pgrep -f 'Google Chrome for Testing.app/Contents' | wc -l | tr -d ' ')"
