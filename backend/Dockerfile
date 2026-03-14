FROM python:3.12-slim

WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends tesseract-ocr \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv
