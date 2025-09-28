# AWS Deployment Guide for DealSphere

## Prerequisites
- AWS CLI configured with appropriate permissions
- Docker installed
- AWS account with ECR, ECS, and RDS access

## Deployment Options

### Option 1: AWS ECS with Fargate (Recommended)

1. **Create ECR Repository**
```bash
aws ecr create-repository --repository-name dealsphere --region us-east-1
```

2. **Build and Push Docker Image**
```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t dealsphere .

# Tag image
docker tag dealsphere:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/dealsphere:latest

# Push image
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/dealsphere:latest
```

3. **Set up RDS PostgreSQL Database**
```bash
aws rds create-db-instance \
    --db-instance-identifier dealsphere-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --master-username postgres \
    --master-user-password your-secure-password \
    --allocated-storage 20 \
    --vpc-security-group-ids sg-xxxxxxxxx \
    --region us-east-1
```

4. **Create ECS Cluster and Service**
```bash
# Create cluster
aws ecs create-cluster --cluster-name dealsphere-cluster

# Create task definition (see task-definition.json)
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
    --cluster dealsphere-cluster \
    --service-name dealsphere-service \
    --task-definition dealsphere-task \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxxxxxx],securityGroups=[sg-xxxxxxxxx],assignPublicIp=ENABLED}"
```

### Option 2: AWS App Runner (Simpler)

1. **Connect to ECR**
2. **Deploy directly from container image**
3. **Configure environment variables**

### Option 3: AWS Lambda with API Gateway

For serverless deployment, the FastAPI app can be adapted using Mangum:

```bash
pip install mangum
```

## Environment Variables Required

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Application port (default: 8000)
- `ENVIRONMENT`: production

## Database Migration

The application will automatically create tables on startup. For production, consider using Alembic migrations.

## Load Balancer Setup

Configure ALB with health check pointing to `/api/health`

## Domain and SSL

- Configure Route 53 for custom domain
- Use AWS Certificate Manager for SSL certificates
- Configure ALB to redirect HTTP to HTTPS

## Monitoring

- Enable CloudWatch logs
- Set up CloudWatch alarms for health checks
- Configure AWS X-Ray for distributed tracing

## Cost Optimization

- Use Fargate Spot for development environments
- Configure auto-scaling based on CPU/memory usage
- Use RDS reserved instances for production