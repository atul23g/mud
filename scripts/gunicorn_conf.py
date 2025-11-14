import multiprocessing
import os

# Bind address
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")

# Workers and worker class (Uvicorn ASGI worker)
workers = int(os.getenv("GUNICORN_WORKERS", str(multiprocessing.cpu_count() * 2 + 1)))
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "uvicorn.workers.UvicornWorker")

# Timeouts and keepalive
timeout = int(os.getenv("GUNICORN_TIMEOUT", "60"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))

# Logging
accesslog = os.getenv("GUNICORN_ACCESSLOG", "-")  # '-' for stdout
errorlog = os.getenv("GUNICORN_ERRORLOG", "-")
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

# Graceful reload in dev (off by default)
reload = os.getenv("GUNICORN_RELOAD", "false").lower() == "true"

# Max requests per worker to mitigate memory leaks
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "0"))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "0"))
