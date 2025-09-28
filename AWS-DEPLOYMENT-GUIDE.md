# DealSphere AWS Deployment Guide

## Overview
DealSphere is a Python FastAPI application with React frontend, designed for production deployment on AWS. This guide covers complete deployment to AWS using containerized infrastructure.

## Prerequisites
- AWS CLI configured with appropriate permissions
- Docker installed locally
- AWS account with access to: ECR, ECS, RDS, VPC, IAM
- Domain name (optional, for custom domain)

## Architecture Overview
```
Internet → ALB → ECS Fargate → RDS PostgreSQL
                     ↓
              CloudWatch Logs
```

## Step 1: Prepare the Application

### 1.1 Build Frontend
```bash
npm install
npm run build
```

### 1.2 Test Local Docker Build
```bash
docker build -t dealsphere .
docker run -p 8000:8000 -e DATABASE_URL="your-db-url" dealsphere
```

## Step 2: AWS Infrastructure Setup

### 2.1 Create VPC and Security Groups
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=dealsphere-vpc}]'

# Create public subnets (2 AZs for ALB)
aws ec2 create-subnet --vpc-id vpc-xxxxxxxxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=dealsphere-public-1}]'
aws ec2 create-subnet --vpc-id vpc-xxxxxxxxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=dealsphere-public-2}]'

# Create private subnets for RDS
aws ec2 create-subnet --vpc-id vpc-xxxxxxxxx --cidr-block 10.0.3.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=dealsphere-private-1}]'
aws ec2 create-subnet --vpc-id vpc-xxxxxxxxx --cidr-block 10.0.4.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=dealsphere-private-2}]'

# Create Internet Gateway
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=dealsphere-igw}]'
aws ec2 attach-internet-gateway --vpc-id vpc-xxxxxxxxx --internet-gateway-id igw-xxxxxxxxx

# Create Security Groups
aws ec2 create-security-group --group-name dealsphere-alb-sg --description "ALB Security Group" --vpc-id vpc-xxxxxxxxx
aws ec2 create-security-group --group-name dealsphere-ecs-sg --description "ECS Security Group" --vpc-id vpc-xxxxxxxxx
aws ec2 create-security-group --group-name dealsphere-rds-sg --description "RDS Security Group" --vpc-id vpc-xxxxxxxxx
```

### 2.2 Configure Security Group Rules
```bash
# ALB Security Group - Allow HTTP/HTTPS from internet
aws ec2 authorize-security-group-ingress --group-id sg-alb-xxxxxxxxx --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id sg-alb-xxxxxxxxx --protocol tcp --port 443 --cidr 0.0.0.0/0

# ECS Security Group - Allow traffic from ALB
aws ec2 authorize-security-group-ingress --group-id sg-ecs-xxxxxxxxx --protocol tcp --port 8000 --source-group sg-alb-xxxxxxxxx

# RDS Security Group - Allow traffic from ECS
aws ec2 authorize-security-group-ingress --group-id sg-rds-xxxxxxxxx --protocol tcp --port 5432 --source-group sg-ecs-xxxxxxxxx
```

## Step 3: Database Setup (RDS PostgreSQL)

### 3.1 Create DB Subnet Group
```bash
aws rds create-db-subnet-group \
    --db-subnet-group-name dealsphere-db-subnet-group \
    --db-subnet-group-description "Subnet group for DealSphere database" \
    --subnet-ids subnet-private-1 subnet-private-2
```

### 3.2 Create RDS Instance
```bash
aws rds create-db-instance \
    --db-instance-identifier dealsphere-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username postgres \
    --master-user-password 'YourSecurePassword123!' \
    --allocated-storage 20 \
    --storage-type gp2 \
    --vpc-security-group-ids sg-rds-xxxxxxxxx \
    --db-subnet-group-name dealsphere-db-subnet-group \
    --backup-retention-period 7 \
    --deletion-protection \
    --publicly-accessible false \
    --tags Key=Name,Value=dealsphere-database
```

### 3.3 Store Database URL in Secrets Manager
```bash
aws secretsmanager create-secret \
    --name dealsphere/database-url \
    --description "Database URL for DealSphere" \
    --secret-string '{"DATABASE_URL":"postgresql+asyncpg://postgres:YourSecurePassword123!@dealsphere-db.xxxxxxxxx.us-east-1.rds.amazonaws.com:5432/postgres"}'
```

## Step 4: Container Registry (ECR)

### 4.1 Create ECR Repository
```bash
aws ecr create-repository --repository-name dealsphere --region us-east-1
```

### 4.2 Build and Push Docker Image
```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t dealsphere .

# Tag image
docker tag dealsphere:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/dealsphere:latest

# Push image
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/dealsphere:latest
```

## Step 5: ECS Cluster and Service

### 5.1 Create ECS Cluster
```bash
aws ecs create-cluster --cluster-name dealsphere-cluster --capacity-providers FARGATE --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1
```

### 5.2 Create IAM Roles

#### Task Execution Role
```bash
# Create trust policy
cat > task-execution-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://task-execution-trust-policy.json

# Attach policies
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

### 5.3 Create Task Definition
```bash
cat > task-definition.json << EOF
{
  "family": "dealsphere-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "dealsphere-container",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/dealsphere:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "PORT",
          "value": "8000"
        },
        {
          "name": "ENVIRONMENT",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:dealsphere/database-url:DATABASE_URL::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/dealsphere",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:8000/api/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

# Create CloudWatch Log Group
aws logs create-log-group --log-group-name /ecs/dealsphere

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

## Step 6: Application Load Balancer

### 6.1 Create ALB
```bash
aws elbv2 create-load-balancer \
    --name dealsphere-alb \
    --subnets subnet-public-1 subnet-public-2 \
    --security-groups sg-alb-xxxxxxxxx \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4
```

### 6.2 Create Target Group
```bash
aws elbv2 create-target-group \
    --name dealsphere-tg \
    --protocol HTTP \
    --port 8000 \
    --vpc-id vpc-xxxxxxxxx \
    --target-type ip \
    --health-check-enabled \
    --health-check-path /api/health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3
```

### 6.3 Create ALB Listener
```bash
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:loadbalancer/app/dealsphere-alb/xxxxxxxxx \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/dealsphere-tg/xxxxxxxxx
```

## Step 7: Create ECS Service

```bash
aws ecs create-service \
    --cluster dealsphere-cluster \
    --service-name dealsphere-service \
    --task-definition dealsphere-task:1 \
    --desired-count 2 \
    --launch-type FARGATE \
    --platform-version LATEST \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-public-1,subnet-public-2],securityGroups=[sg-ecs-xxxxxxxxx],assignPublicIp=ENABLED}" \
    --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/dealsphere-tg/xxxxxxxxx,containerName=dealsphere-container,containerPort=8000 \
    --health-check-grace-period-seconds 120
```

## Step 8: Domain and SSL (Optional)

### 8.1 Request SSL Certificate
```bash
aws acm request-certificate \
    --domain-name yourdomain.com \
    --domain-name www.yourdomain.com \
    --validation-method DNS \
    --subject-alternative-names *.yourdomain.com
```

### 8.2 Create HTTPS Listener
```bash
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:loadbalancer/app/dealsphere-alb/xxxxxxxxx \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/xxxxxxxxx \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/dealsphere-tg/xxxxxxxxx
```

### 8.3 Configure Route 53
```bash
# Create hosted zone
aws route53 create-hosted-zone --name yourdomain.com --caller-reference $(date +%s)

# Create A record pointing to ALB
aws route53 change-resource-record-sets --hosted-zone-id ZXXXXXXXXXXXXX --change-batch file://dns-record.json
```

## Step 9: Monitoring and Scaling

### 9.1 Enable Auto Scaling
```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/dealsphere-cluster/dealsphere-service \
    --min-capacity 2 \
    --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
    --policy-name dealsphere-scaling-policy \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/dealsphere-cluster/dealsphere-service \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

### 9.2 CloudWatch Alarms
```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "DealSphere-HighCPU" \
    --alarm-description "Alarm when CPU exceeds 70%" \
    --metric-name CPUUtilization \
    --namespace AWS/ECS \
    --statistic Average \
    --period 300 \
    --threshold 70 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2

# Application health alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "DealSphere-HealthCheck" \
    --alarm-description "Alarm when health check fails" \
    --metric-name UnHealthyHostCount \
    --namespace AWS/ApplicationELB \
    --statistic Average \
    --period 60 \
    --threshold 0 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2
```

## Step 10: Deployment Automation (CI/CD)

### 10.1 GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS ECS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: dealsphere
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

      - name: Update ECS service
        run: |
          aws ecs update-service --cluster dealsphere-cluster --service dealsphere-service --force-new-deployment
```

## Cost Estimation

### Monthly Costs (us-east-1):
- **ECS Fargate (2 tasks)**: ~$30-40
- **RDS t3.micro**: ~$15-20
- **ALB**: ~$20-25
- **Data Transfer**: ~$5-10
- **CloudWatch Logs**: ~$5
- **Total**: ~$75-100/month

### Cost Optimization:
- Use Fargate Spot for development
- Reserved instances for RDS in production
- CloudWatch log retention policies
- Auto-scaling to handle traffic spikes

## Security Best Practices

1. **Network Security**:
   - Private subnets for RDS
   - Security groups with minimal required access
   - VPC Flow Logs enabled

2. **Application Security**:
   - Secrets stored in AWS Secrets Manager
   - Container runs as non-root user
   - Regular security updates

3. **Access Control**:
   - IAM roles with least privilege
   - CloudTrail for audit logging
   - Multi-factor authentication

## Troubleshooting

### Common Issues:

1. **Service won't start**:
   ```bash
   aws ecs describe-services --cluster dealsphere-cluster --services dealsphere-service
   aws logs get-log-events --log-group-name /ecs/dealsphere --log-stream-name ecs/dealsphere-container/task-id
   ```

2. **Health check failures**:
   ```bash
   aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:...
   ```

3. **Database connection issues**:
   ```bash
   aws rds describe-db-instances --db-instance-identifier dealsphere-db
   ```

## Production Checklist

- [ ] SSL certificate configured
- [ ] Domain name pointing to ALB
- [ ] Auto-scaling enabled
- [ ] CloudWatch alarms configured
- [ ] Database backups enabled
- [ ] Security groups restricted
- [ ] IAM roles follow least privilege
- [ ] CloudTrail enabled
- [ ] Regular security updates scheduled

## Support and Maintenance

1. **Monitoring**: Use CloudWatch dashboards for real-time metrics
2. **Logging**: Centralized logging with CloudWatch Logs
3. **Updates**: Blue-green deployments for zero-downtime updates
4. **Backup**: Automated RDS backups with point-in-time recovery
5. **Disaster Recovery**: Multi-AZ RDS deployment for high availability

For additional support, refer to AWS documentation or contact your AWS support team.