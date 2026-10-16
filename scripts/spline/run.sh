#!/bin/bash
# usage: run.sh <outBin> <partsGlob> [sample.mjs flags...]; retries with a larger oversample until enough samples survive culling
out="$1"; parts="$2"; shift 2
for over in 1.6 2.4 3.6 5.5; do
  node "$(dirname "$0")/sample.mjs" "$(dirname "$0")/../spline-recv" "$out" "$parts" --over $over "$@" && exit 0
  [ $? -eq 2 ] || exit 1
done
