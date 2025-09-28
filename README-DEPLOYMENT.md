# DealSphere - Python FastAPI Backend

This application has been completely migrated from TypeScript/Node.js to Python FastAPI for better performance and deployment flexibility.

## Quick Start

### Local Development
```bash
# Install Python dependencies
pip install fastapi uvicorn sqlalchemy asyncpg psycopg2-binary python-dotenv pydantic

# Build frontend
npm run build

# Start Python backend
cd python_backend
python3 simple_server.py
```

### Using Docker
```bash
# Build image
docker build -t dealsphere .

# Run with docker-compose
docker-compose up
```

## Architecture

- **Frontend**: React + TypeScript + Vite (built to static files)
- **Backend**: Python FastAPI with async/await
- **Database**: PostgreSQL with SQLAlchemy async ORM
- **Deployment**: Docker containers ready for AWS ECS

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/deals` - Get all deals
- `POST /api/deals/{id}/click` - Track deal clicks
- `POST /api/deals/{id}/share` - Track social shares
- `GET /` - Serve React frontend

## AWS Deployment

Complete deployment instructions are in `aws-deploy.md`:

1. **Container**: Docker image with multi-stage build
2. **Database**: AWS RDS PostgreSQL
3. **Compute**: AWS ECS Fargate or App Runner
4. **Load Balancer**: Application Load Balancer with health checks
5. **Monitoring**: CloudWatch logs and metrics

## Features

- ✅ Public deals browsing (no authentication required)
- ✅ AI-categorized deals (Top, Hot, Latest)
- ✅ Social sharing functionality
- ✅ Click and share tracking
- ✅ Responsive design with Tailwind CSS
- ✅ Production-ready Docker configuration
- ✅ AWS deployment ready

## Environment Variables

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db
PORT=5000
ENVIRONMENT=production
```

## Development vs Production

- **Development**: Uses Replit's built-in PostgreSQL
- **Production**: Uses AWS RDS PostgreSQL
- **Scaling**: FastAPI handles concurrent requests efficiently
- **Monitoring**: Built-in health checks and logging