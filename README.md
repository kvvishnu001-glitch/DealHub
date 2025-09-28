# DealSphere - Python FastAPI Backend

## 🚀 Complete Python Migration

This application has been **completely migrated** from TypeScript/Node.js to **Python FastAPI** for better performance, reliability, and AWS deployment readiness.

### ✅ What's Been Cleaned Up
- ❌ Removed all TypeScript server code (`server/`, `shared/`)
- ❌ Removed authentication dependencies (no longer needed)
- ❌ Removed Drizzle ORM TypeScript configuration
- ✅ Pure Python FastAPI backend with SQLAlchemy
- ✅ React frontend builds to static files served by Python
- ✅ Docker containerization ready for AWS

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │───▶│  Python FastAPI │───▶│   PostgreSQL    │
│  (Static Files) │    │   (Async ORM)   │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Frontend
- **React + TypeScript** (builds to static files)
- **Tailwind CSS + Shadcn/ui** for styling
- **TanStack Query** for API state management
- **Wouter** for client-side routing

### Backend
- **Python FastAPI** with async/await
- **SQLAlchemy + asyncpg** for PostgreSQL
- **Static file serving** for React frontend
- **Health checks** for AWS load balancers

## 🚀 Quick Start

### Local Development
```bash
# 1. Build frontend
npm install
npm run build

# 2. Install Python dependencies
pip install fastapi uvicorn sqlalchemy asyncpg psycopg2-binary python-dotenv pydantic

# 3. Start Python backend
cd python_backend
python3 app.py
```

Application runs on: http://localhost:8000

### Using Docker
```bash
# Build and run with Docker
docker build -t dealsphere .
docker run -p 8000:8000 -e DATABASE_URL="postgresql+asyncpg://..." dealsphere

# Or use docker-compose
docker-compose up
```

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check for load balancers |
| GET | `/api/deals` | Get all active deals |
| POST | `/api/deals/{id}/click` | Track deal clicks |
| POST | `/api/deals/{id}/share` | Track social shares |
| GET | `/*` | Serve React frontend (SPA routing) |

## ☁️ AWS Deployment

### Quick Deploy Options

#### Option 1: AWS ECS Fargate (Recommended)
- **Scalable**: Auto-scaling based on traffic
- **Managed**: AWS handles infrastructure
- **Cost**: ~$75-100/month

#### Option 2: AWS App Runner  
- **Simpler**: Deploy directly from container
- **Automatic**: Built-in CI/CD
- **Cost**: ~$50-75/month

#### Option 3: AWS Lambda
- **Serverless**: Pay per request
- **Scale to zero**: No idle costs
- **Cost**: ~$10-30/month (low traffic)

### Detailed Deployment Guide
See **[AWS-DEPLOYMENT-GUIDE.md](./AWS-DEPLOYMENT-GUIDE.md)** for complete step-by-step instructions including:

- VPC and security group setup
- RDS PostgreSQL configuration
- ECR container registry setup
- ECS cluster and service creation
- Application Load Balancer configuration
- Auto-scaling and monitoring
- CI/CD with GitHub Actions
- SSL certificates and custom domains

## 🛠️ Environment Variables

```bash
# Required
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db

# Optional
PORT=8000                    # Server port (default: 8000)
ENVIRONMENT=production       # Environment mode
```

## 📁 Project Structure

```
├── python_backend/          # 🐍 Python FastAPI backend
│   ├── app.py              # Main application file
│   ├── database.py         # Database connection
│   ├── models.py           # SQLAlchemy models
│   └── seed_data.py        # Sample data
├── client/                  # ⚛️ React frontend
│   ├── src/
│   ├── dist/               # Built static files (served by Python)
│   └── package.json
├── Dockerfile              # 🐳 Container configuration
├── docker-compose.yml      # Local development
├── task-definition.json    # AWS ECS configuration
└── AWS-DEPLOYMENT-GUIDE.md # 📖 Complete deployment guide
```

## 🔧 Development vs Production

### Development (Replit)
- Uses Replit's PostgreSQL database
- Hot reload with `uvicorn --reload`
- CORS enabled for all origins
- Detailed error messages

### Production (AWS)
- Uses AWS RDS PostgreSQL
- Optimized container image
- Restricted CORS origins
- Production logging and monitoring
- Health checks for load balancer
- Auto-scaling based on demand

## 🚨 Troubleshooting

### Common Issues

1. **"Module not found" errors**
   ```bash
   # Install Python dependencies
   pip install -r requirements.txt
   ```

2. **Database connection fails**
   ```bash
   # Check DATABASE_URL format
   echo $DATABASE_URL
   # Should be: postgresql+asyncpg://user:pass@host:port/db
   ```

3. **Frontend not loading**
   ```bash
   # Build frontend first
   npm run build
   # Check if dist/ folder exists
   ls client/dist/
   ```

4. **Docker build fails**
   ```bash
   # Build with verbose output
   docker build -t dealsphere . --progress=plain
   ```

## 🎯 Features

### Public Features (No Auth Required)
- ✅ Browse all deals (Top, Hot, Latest)
- ✅ Social sharing (Twitter, Facebook, WhatsApp)
- ✅ Click tracking for analytics
- ✅ Responsive design for mobile/desktop
- ✅ Fast search and filtering

### Admin Features (Future)
- 🔄 Deal approval workflow
- 📊 Analytics dashboard  
- 🤖 AI-powered deal validation
- 📈 Performance metrics

## 🔐 Security

### Production Security
- Environment variables for secrets
- Database connection pooling
- Rate limiting on API endpoints
- CORS restricted to known origins
- Container runs as non-root user
- Security headers enabled

### AWS Security
- VPC with private subnets for database
- Security groups with minimal access
- Secrets stored in AWS Secrets Manager
- IAM roles with least privilege
- CloudTrail audit logging

## 📊 Monitoring

### Health Checks
- `/api/health` endpoint for load balancer
- Database connectivity verification
- Application startup validation

### Logging
- Structured JSON logging
- CloudWatch Logs integration
- Error tracking and alerting
- Performance metrics

## 📈 Cost Optimization

### AWS Cost Breakdown (Monthly)
- **ECS Fargate (2 tasks)**: $30-40
- **RDS t3.micro**: $15-20  
- **Application Load Balancer**: $20-25
- **Data Transfer**: $5-10
- **CloudWatch Logs**: $5
- **Total**: ~$75-100/month

### Optimization Tips
- Use Fargate Spot for development
- Reserved instances for RDS in production
- CloudWatch log retention policies
- Auto-scaling to handle traffic efficiently

## 🤝 Contributing

1. **Frontend changes**: Edit files in `client/src/`
2. **Backend changes**: Edit files in `python_backend/`
3. **Build**: Run `npm run build` after frontend changes
4. **Test**: Use `docker-compose up` for full stack testing

## 📞 Support

- **Documentation**: See AWS-DEPLOYMENT-GUIDE.md
- **Issues**: Check logs with `docker logs container_name`
- **AWS Support**: Use AWS Support Center for deployment issues
- **Database**: Monitor RDS performance in AWS Console

---

**Ready for production deployment on AWS! 🚀**