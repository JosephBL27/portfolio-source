#!/bin/zsh
# Strict RAM watchdog for agent workflows (Joseph, 2026-10-09: "not strict enough"). Every 15 s, ALWAYS:
#  - kill Chrome-for-Testing processes orphaned to launchd (PPID 1: crash-pad handlers / leftovers) older than 30 s
#  - at most 2 test browsers: kill the oldest beyond 2; kill any test browser older than 25 min (stuck test)
#  - kill a browser that has more than 6 renderer processes (leaking pages)
#  - at most 4 vite dev servers: kill the oldest beyond 4; kill any older than 60 min
#  - under pressure (free < 35% or swap > 12 GB): at most 1 browser and 2 vite servers
# usage: LOG=/path scripts/memguard.sh [hours=6]
LOG=${LOG:-/tmp/memguard.log}; hours=${1:-6}; end=$(( $(date +%s) + hours*3600 ))
APP="Google Chrome for Testing.app"
MAIN="$APP/Contents/MacOS/Google Chrome for Testing"
secs() { local s; s=$(ps -o etime= -p $1 2>/dev/null | tr -d ' '); [ -z "$s" ] && { echo 0; return }; local d=0; [[ $s == *-* ]] && { d=${s%%-*}; s=${s#*-} }; local p=(${(s/:/)s}); local h=0 m=0 x=0
  if (( ${#p} == 3 )); then h=$p[1]; m=$p[2]; x=$p[3]; elif (( ${#p} == 2 )); then m=$p[1]; x=$p[2]; else x=$p[1]; fi
  echo $(( 10#$d*86400 + 10#$h*3600 + 10#$m*60 + 10#$x )); }
mains_now() { ps -eo pid=,command= | grep -F "$MAIN" | grep -v -e "Helper" -e "crashpad" -e grep | awk '{print $1}'; }
oldest_first() { for p in "$@"; do echo "$(secs $p) $p"; done | sort -rn | awk '{print $2}'; }
while (( $(date +%s) < end )); do
  k=0
  for pid in $(pgrep -f "$APP"); do [ "$(ps -o ppid= -p $pid | tr -d ' ')" = "1" ] && (( $(secs $pid) > 30 )) && kill $pid 2>/dev/null && k=$((k+1)); done
  free=$(memory_pressure 2>/dev/null | awk '/free percentage/ {gsub("%","",$NF); print $NF}'); free=${free:-100}
  swap=$(sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9.]+)M.*/\1/'); swap=${swap%.*}
  maxb=2; maxv=4; (( free < 35 || swap > 12288 )) && { maxb=1; maxv=2 }
  mains=($(mains_now))
  for pid in $mains; do
    (( $(secs $pid) > 1500 )) && { kill $pid 2>/dev/null; k=$((k+1)); continue }
    r=$(pgrep -P $pid -f -- "--type=renderer" | wc -l | tr -d ' '); (( r > 6 )) && { kill $pid 2>/dev/null; k=$((k+1)) }
  done
  mains=($(mains_now))
  if (( ${#mains} > maxb )); then for pid in $(oldest_first $mains | head -n $(( ${#mains} - maxb ))); do kill $pid 2>/dev/null; k=$((k+1)); done; fi
  vites=($(pgrep -f "node_modules/.bin/vite --port"))
  for pid in $vites; do (( $(secs $pid) > 3600 )) && kill $pid 2>/dev/null && k=$((k+1)); done
  vites=($(pgrep -f "node_modules/.bin/vite --port"))
  if (( ${#vites} > maxv )); then for pid in $(oldest_first $vites | head -n $(( ${#vites} - maxv ))); do kill $pid 2>/dev/null; k=$((k+1)); done; fi
  procs=$(pgrep -f "$APP" | wc -l | tr -d ' ')
  echo "$(date +%H:%M:%S) free=${free}% swap=${swap}M browsers=$(mains_now | wc -l | tr -d ' ') chrome_procs=$procs vite=$(pgrep -f 'node_modules/.bin/vite --port' | wc -l | tr -d ' ') limits=${maxb}b/${maxv}v killed=$k" >> $LOG
  sleep 15
done
