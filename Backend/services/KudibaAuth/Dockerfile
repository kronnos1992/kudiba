FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/app \
    PATH=/home/app/.local/bin:$PATH

RUN groupadd --system app && useradd --system --gid app --home-dir /app app
COPY --from=builder --chown=app:app /root/.local /home/app/.local
COPY --chown=app:app src /app/src
USER app

EXPOSE 8082

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8082/health')" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8082"]
