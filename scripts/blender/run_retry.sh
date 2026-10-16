#!/bin/zsh
# Run a headless Blender command under the machine's limits: swap guard, optional lock, no Python bytecode, retry on an external SIGTERM (rc 143).
# usage: run_retry.sh <tries> <time-log-prefix> /Applications/Blender.app/Contents/MacOS/Blender -b ... [args]
#   SWAP_CAP_GB       refuse to start, and stop retrying, when swap used is above this (MB / 1000, the strict reading; default 24.5; Joseph's cap is 25)
#   BLENDER_LOCK_DIR  if set, `mkdir` it as the one-Blender lock (waits up to 10 min) and `rmdir` it on exit, also on failure
# Observed 2026-10-12: long headless renders were SIGTERMed by a process that is not ours (other agents share the machine); every retry adds 9-11 GB of footprint.
# Bytecode: Blender ignores PYTHONDONTWRITEBYTECODE unless --python-use-system-env is passed, so the flag is inserted right after the executable (with
# PYTHONNOUSERSITE so no user site-packages leak in). Without it every run writes scripts/blender/__pycache__ into the repo.
tries=$1; pre=$2; shift 2
cap=${SWAP_CAP_GB:-24.5}
swap_used_gb() { sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9.]+)M.*/\1/' | awk '{printf "%.2f", $1/1000}'; }
over_cap() { awk -v u="$(swap_used_gb)" -v c="$cap" 'BEGIN{exit !(u>c)}'; }
if [ -n "$BLENDER_LOCK_DIR" ]; then
  for w in $(seq 1 60); do mkdir "$BLENDER_LOCK_DIR" 2>/dev/null && break; sleep 10; done
  [ -d "$BLENDER_LOCK_DIR" ] || { echo "lock $BLENDER_LOCK_DIR busy"; exit 75; }
  trap 'rmdir "$BLENDER_LOCK_DIR" 2>/dev/null' EXIT
fi
cmd=("$1"); shift
case "${cmd[1]:t}" in Blender) cmd+=(--python-use-system-env);; esac
for i in $(seq 1 $tries); do
  if over_cap; then echo "swap $(swap_used_gb) GB is above the $cap GB cap: not starting try $i"; exit 75; fi
  PYTHONDONTWRITEBYTECODE=1 PYTHONNOUSERSITE=1 /usr/bin/time -l "${cmd[@]}" "$@" > "$pre.try$i.stdout.txt" 2> "$pre.try$i.time.txt"; rc=$?
  echo "try $i rc=$rc"
  [ $rc -ne 143 ] && { cp "$pre.try$i.time.txt" "$pre.time.txt"; cp "$pre.try$i.stdout.txt" "$pre.stdout.txt"; exit $rc; }
done
exit 143
