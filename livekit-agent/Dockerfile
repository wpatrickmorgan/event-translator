# Dockerfile for LiveKit Translation Agent
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY . .

# Create non-root user for security
RUN groupadd -r agent && useradd -r -g agent agent
RUN chown -R agent:agent /app
USER agent

# Health check endpoint (optional, LiveKit provides this)
EXPOSE 8081

# Download any required model files (if needed)
# RUN python agent.py download-files

# Run the translation agent
CMD ["python", "agent.py", "start"]
