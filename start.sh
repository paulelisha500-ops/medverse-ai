#!/bin/sh
# Entrypoint for the single-container Hugging Face Space image (see Dockerfile).
# Generates a session-signing key on first boot when none was set as a Space
# secret, so the demo runs with zero configuration. Set SECRET_KEY as a Space
# secret instead if you want logins to survive a container restart.
set -e

if [ -z "$SECRET_KEY" ]; then
    export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
    echo "[start.sh] No SECRET_KEY set — generated a random one for this session."
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-7860}"
