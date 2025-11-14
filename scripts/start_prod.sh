#!/usr/bin/env bash

set -euo pipefail

echo "==> Starting Disease AI API (production)"

# Ensure .env present
if [ ! -f .env ]; then
  echo "❌ .env not found. Copy .env.example to .env and set values."
  exit 1
fi

# Activate venv if available
if [ -z "${VIRTUAL_ENV:-}" ] && [ -d "venv" ]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

# Minimal runtime checks
python - <<'PY'
from dotenv import load_dotenv; load_dotenv(".env")
import os
required = [
  ("DATABASE_URL", False),
]
missing = [k for k,allow_empty in required if not os.getenv(k) and not allow_empty]
if missing:
  raise SystemExit(f"Missing required env vars: {', '.join(missing)}")
print("✅ Env check passed")
PY

# Default Gunicorn env
export GUNICORN_BIND=${GUNICORN_BIND:-0.0.0.0:8000}
export GUNICORN_WORKERS=${GUNICORN_WORKERS:-$(python - <<'PY'
import multiprocessing
print(multiprocessing.cpu_count()*2+1)
PY
)}
export GUNICORN_WORKER_CLASS=${GUNICORN_WORKER_CLASS:-uvicorn.workers.UvicornWorker}

# Launch
exec gunicorn -c scripts/gunicorn_conf.py src.api.main:app
