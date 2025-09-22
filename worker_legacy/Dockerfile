FROM python:3.11-slim AS typecheck

WORKDIR /app

# Install runtime deps + mypy for type checking
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt mypy

# Copy code and mypy config, then run type check
COPY main.py .
COPY config.py .
COPY models.py .
COPY worker.py .
COPY audio/ ./audio/
COPY providers/ ./providers/
COPY room/ ./room/
COPY mypy.ini .
RUN mypy --config-file mypy.ini . && touch /mypy_ok


FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ensure typecheck stage runs as part of the build (fails build if mypy fails)
COPY --from=typecheck /mypy_ok /mypy_ok

# Copy application code
COPY main.py .
COPY config.py .
COPY models.py .
COPY worker.py .

# Copy modular architecture directories
COPY audio/ ./audio/
COPY providers/ ./providers/
COPY room/ ./room/

# Create directory for Google credentials
RUN mkdir -p /app

# Default command: run LiveKit translation worker
CMD ["python", "main.py"]
