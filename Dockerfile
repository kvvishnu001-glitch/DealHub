# Multi-stage build for production deployment
FROM node:18-alpine as frontend-builder

# Build frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY client/ ./client/
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY tsconfig.json ./
RUN npm run build

# Python backend
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY python_backend/ ./python_backend/
COPY pyproject.toml ./
COPY uv.lock ./
RUN pip install -U pip
RUN pip install fastapi uvicorn[standard] sqlalchemy asyncpg psycopg2-binary python-dotenv pydantic alembic

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/client/dist ./client/dist

# Copy shared schema
COPY shared/ ./shared/

# Change to python_backend directory
WORKDIR /app/python_backend

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

# Run the application
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]