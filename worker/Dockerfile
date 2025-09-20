FROM python:3.11-slim AS typecheck

WORKDIR /app

# Install runtime deps + mypy for type checking
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt mypy

# Copy code and mypy config, then run type check
COPY main.py .
COPY mypy.ini .
RUN mypy --config-file mypy.ini main.py && touch /mypy_ok


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

# Create directory for Google credentials
RUN mkdir -p /app

# Default command: run Agents worker in production mode
CMD ["python", "main.py", "start"]
