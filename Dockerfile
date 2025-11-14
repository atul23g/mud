# syntax=docker/dockerfile:1
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps (add tesseract-ocr if you need OCR inside container)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first to leverage Docker layer caching
COPY requirements.txt ./
RUN python -m pip install --upgrade pip && \
    python -m pip install -r requirements.txt

# Copy project files
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src

# Generate Prisma client during build so runtime is ready
RUN python -m prisma generate

# Expose API port
EXPOSE 8000

# Default env (override at runtime)
ENV GUNICORN_BIND=0.0.0.0:8000 \
    GUNICORN_WORKER_CLASS=uvicorn.workers.UvicornWorker \
    ALLOWED_HOSTS="*" \
    ALLOWED_ORIGINS="*" \
    FORCE_HTTPS=false

# Start production server
CMD ["bash", "scripts/start_prod.sh"]
