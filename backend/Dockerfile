# ── SafetyHub Cloud Backend — Dockerfile ──────────────────────
FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN useradd -m -u 1000 safetyhub
WORKDIR /app
USER safetyhub

# Python dependencies
COPY --chown=safetyhub:safetyhub requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
ENV PATH="/home/safetyhub/.local/bin:$PATH"

# App source
COPY --chown=safetyhub:safetyhub . .

# Render injects PORT env var automatically
EXPOSE 8000

# Healthcheck — Render uses this to verify the app is alive
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Start command
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
