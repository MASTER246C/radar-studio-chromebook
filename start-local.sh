#!/bin/sh
# Serve this folder only, on loopback. No installs, no USB access, no firmware writes.
set -eu
cd -- "$(dirname -- "$0")"
echo 'Open http://localhost:8000 in normal ChromeOS Chrome. Press Ctrl+C to stop.'
exec python3 -m http.server 8000 --bind 127.0.0.1
