#!/bin/bash

# DealSphere AWS Deployment Script
# This script automates the complete deployment process

set -e

echo "🚀 DealSphere AWS Deployment Script"
echo "====================================="

# Configuration
REGION="us-east-1"
CLUSTER_NAME="dealsphere-cluster"
SERVICE_NAME="dealsphere-service"
REPOSITORY_NAME="dealsphere"
TASK_FAMILY="dealsphere-task"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 AWS Account ID: $ACCOUNT_ID"
echo "🌍 Region: $REGION"

# Step 1: Build frontend
echo ""
echo "📦 Step 1: Building frontend..."
npm install
npm run build

if [ ! -d "client/dist" ]; then
    echo "❌ Frontend build failed - client/dist directory not found"
    exit 1
fi

echo "✅ Frontend built successfully"

# Step 2: Create ECR repository if it doesn't exist
echo ""
echo "🏗️ Step 2: Creating ECR repository..."
if ! aws ecr describe-repositories --repository-names $REPOSITORY_NAME --region $REGION &> /dev/null; then
    aws ecr create-repository --repository-name $REPOSITORY_NAME --region $REGION
    echo "✅ ECR repository created"
else
    echo "✅ ECR repository already exists"
fi

# Step 3: Build and push Docker image
echo ""
echo "🐳 Step 3: Building and pushing Docker image..."

# Login to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Build image
docker build -t $REPOSITORY_NAME .

# Tag image
IMAGE_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME:latest"
docker tag $REPOSITORY_NAME:latest $IMAGE_URI

# Push image
docker push $IMAGE_URI

echo "✅ Docker image pushed to ECR: $IMAGE_URI"

# Step 4: Update task definition
echo ""
echo "📋 Step 4: Updating ECS task definition..."

# Replace placeholders in task definition
sed "s/ACCOUNT_ID/$ACCOUNT_ID/g" task-definition.json > task-definition-updated.json

# Register task definition
TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://task-definition-updated.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "✅ Task definition registered: $TASK_DEFINITION_ARN"

# Step 5: Update ECS service
echo ""
echo "🔄 Step 5: Updating ECS service..."

if aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION &> /dev/null; then
    # Update existing service
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --task-definition $TASK_FAMILY \
        --force-new-deployment \
        --region $REGION > /dev/null
    
    echo "✅ ECS service updated"
    
    # Wait for deployment to complete
    echo "⏳ Waiting for deployment to complete..."
    aws ecs wait services-stable --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION
    
    echo "✅ Deployment completed successfully"
else
    echo "⚠️ ECS service not found. Please create the service first using the AWS-DEPLOYMENT-GUIDE.md"
fi

# Step 6: Get service URL
echo ""
echo "🌐 Step 6: Getting service information..."

# Get load balancer DNS name
if aws elbv2 describe-load-balancers --names dealsphere-alb --region $REGION &> /dev/null; then
    LB_DNS=$(aws elbv2 describe-load-balancers \
        --names dealsphere-alb \
        --region $REGION \
        --query 'LoadBalancers[0].DNSName' \
        --output text)
    
    echo "🎉 Application URL: http://$LB_DNS"
    echo "🔍 Health Check: http://$LB_DNS/api/health"
else
    echo "⚠️ Load balancer not found. Please create it using the AWS-DEPLOYMENT-GUIDE.md"
fi

# Cleanup
rm -f task-definition-updated.json

echo ""
echo "🎉 Deployment script completed!"
echo ""
echo "📖 Next steps:"
echo "   1. Check service status: aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME"
echo "   2. View logs: aws logs get-log-events --log-group-name /ecs/dealsphere --log-stream-name <stream-name>"
echo "   3. Monitor deployment in AWS Console: ECS > Clusters > $CLUSTER_NAME"
echo ""
echo "📚 For complete infrastructure setup, see: AWS-DEPLOYMENT-GUIDE.md"