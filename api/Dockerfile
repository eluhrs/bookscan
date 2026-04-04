FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS dev
# dev image: code mounted as volume, uvicorn --reload set in compose override

FROM base AS prod
COPY . .
RUN mkdir -p /app/covers
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8001"]
