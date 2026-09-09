#!/usr/bin/env bash
# Redirected to start_live.sh to prevent any synthetic/fake data injection
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
exec "$DIR/scripts/start_live.sh" "$@"
