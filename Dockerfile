# Single-container image for Hugging Face Spaces (Docker SDK).
#
# Builds the React/Vite frontend, then serves it plus the FastAPI backend from
# one process on one port — no docker-compose, no second container, nothing
# for a visitor to run locally. `backend/Dockerfile` + `frontend/Dockerfile` +
# `docker-compose.yml` are unrelated and still describe the two-container
# local dev setup; this file is only for the deployed Space.

FROM node:20-alpine AS frontend-build
WORKDIR /fe
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --default-timeout=120 --retries 10 torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir --default-timeout=120 --retries 10 -r requirements.txt

COPY backend/ .
COPY --from=frontend-build /fe/dist ./static
COPY start.sh /start.sh
RUN chmod +x /start.sh && mkdir -p /app/data /app/.cache

# Caches (sentence-transformers, HF hub) and the sqlite db need a writable,
# non-root-agnostic home — Spaces containers may run as a non-root uid.
ENV HOME=/app \
    HF_HOME=/app/.cache \
    STATIC_DIR=/app/static \
    PORT=7860
RUN chmod -R 777 /app

EXPOSE 7860

CMD ["/start.sh"]
