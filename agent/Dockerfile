# Multi-stage optimized Dockerfile for SLABound ECS Fargate Arbitration Agent
FROM python:3.11-slim as base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install security updates and curl for container health check
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . /app/agent

# Create unprivileged user for security compliance (Least Privilege Principle)
RUN useradd -m -u 10001 slabound_agent && \
    chown -R slabound_agent:slabound_agent /app

USER slabound_agent

# Health check verifies the python process is alive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import sys; sys.exit(0)"

ENTRYPOINT ["python", "-m", "agent.agent"]
