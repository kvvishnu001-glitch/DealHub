from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import os
from typing import List, Optional
from contextlib import asynccontextmanager

from database import get_db, init_database
from models import Deal, DealCreate, DealResponse, Analytics
from services.deals_service import DealsService
from services.analytics_service import AnalyticsService
from routes import deals, admin, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database
    await init_database()
    yield


app = FastAPI(
    title="DealSphere API",
    description="AI-powered deals and coupons platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(deals.router, prefix="/api", tags=["deals"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "DealSphere API is running"}

# Root endpoint
@app.get("/")
async def root():
    return {"message": "DealSphere API is running", "status": "healthy"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=port, 
        reload=True
    )