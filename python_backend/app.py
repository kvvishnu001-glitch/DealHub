#!/usr/bin/env python3
"""
DealSphere FastAPI Application
Main application file for production deployment
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uvicorn
import os
from pathlib import Path
from contextlib import asynccontextmanager

from database import get_db, init_database
from models import Deal as DealModel
from routes.admin import router as admin_router
from middleware.deal_validation_middleware import DealValidationMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup"""
    await init_database()
    yield

# Create FastAPI application
app = FastAPI(
    title="DealSphere API",
    description="AI-powered deals and coupons platform",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add deal validation middleware (ensures only complete deals are returned)
app.add_middleware(DealValidationMiddleware)

# Include routers
app.include_router(admin_router, prefix="/api")

# Import and include additional routers
from routes.deals import router as deals_router
from routes.validation import router as validation_router
from routes.affiliate_management import router as affiliate_router
from routes.file_upload import router as file_upload_router
from routes.sample_files import router as sample_files_router

app.include_router(deals_router, prefix="/api")
app.include_router(validation_router, prefix="/api")
app.include_router(affiliate_router, prefix="/api/admin/affiliates")
app.include_router(file_upload_router, prefix="/api/admin/deals")
app.include_router(sample_files_router, prefix="/api/admin/deals/samples")

# API Routes
@app.get("/api/health")
async def health_check():
    """Health check endpoint for load balancers"""
    return {"status": "healthy", "message": "DealSphere API is running"}

@app.get("/api/deals")
async def get_deals(db: AsyncSession = Depends(get_db)):
    """Get all active deals"""
    try:
        result = await db.execute(select(DealModel).where(DealModel.is_active == True))
        deals = result.scalars().all()
        
        deals_list = []
        for deal in deals:
            deal_dict = {
                "id": deal.id,
                "title": deal.title,
                "description": deal.description,
                "originalPrice": str(deal.original_price),
                "salePrice": str(deal.sale_price),
                "discountPercentage": deal.discount_percentage,
                "imageUrl": deal.image_url,
                "affiliateUrl": deal.affiliate_url,
                "store": deal.store,
                "storeLogoUrl": deal.store_logo_url,
                "category": deal.category,
                "rating": str(deal.rating) if deal.rating is not None else None,
                "reviewCount": deal.review_count,
                "expiresAt": deal.expires_at.isoformat() if deal.expires_at is not None else None,
                "isActive": deal.is_active,
                "isAiApproved": deal.is_ai_approved,
                "aiScore": str(deal.ai_score) if deal.ai_score is not None else None,
                "aiReasons": deal.ai_reasons,
                "popularity": deal.popularity,
                "clickCount": deal.click_count,
                "shareCount": deal.share_count,
                "dealType": deal.deal_type,
                "sourceApi": deal.source_api,
                "createdAt": deal.created_at.isoformat() if deal.created_at is not None else None,
                "updatedAt": deal.updated_at.isoformat() if deal.updated_at is not None else None
            }
            deals_list.append(deal_dict)
        
        return deals_list
    except Exception as e:
        print(f"Error fetching deals: {e}")
        return []

@app.post("/api/deals/{deal_id}/click")
async def track_deal_click(deal_id: str, db: AsyncSession = Depends(get_db)):
    """Track when a user clicks on a deal"""
    try:
        result = await db.execute(select(DealModel).where(DealModel.id == deal_id))
        deal = result.scalar_one_or_none()
        
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")
        
        # Increment click count
        current_count = deal.click_count if deal.click_count is not None else 0
        deal.click_count = current_count + 1
        await db.commit()
        
        return {"affiliateUrl": deal.affiliate_url}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error tracking click: {e}")
        raise HTTPException(status_code=500, detail="Failed to track click")

@app.post("/api/deals/{deal_id}/share")
async def track_deal_share(deal_id: str, db: AsyncSession = Depends(get_db)):
    """Track when a user shares a deal"""
    try:
        result = await db.execute(select(DealModel).where(DealModel.id == deal_id))
        deal = result.scalar_one_or_none()
        
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")
        
        # Increment share count
        current_count = deal.share_count if deal.share_count is not None else 0
        deal.share_count = current_count + 1
        await db.commit()
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error tracking share: {e}")
        raise HTTPException(status_code=500, detail="Failed to track share")

# Serve static files (built React app)
frontend_dist_path = Path(__file__).parent.parent / "client" / "dist"
if frontend_dist_path.exists():
    # Mount static assets
    app.mount("/assets", StaticFiles(directory=str(frontend_dist_path / "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve React frontend for all non-API routes"""
        # Don't serve frontend for API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        # Serve index.html for all frontend routes
        return FileResponse(str(frontend_dist_path / "index.html"))
else:
    @app.get("/")
    async def root():
        """Development root endpoint when frontend is not built"""
        return {
            "message": "DealSphere API is running", 
            "status": "healthy", 
            "note": "Frontend not built - run 'npm run build' to build frontend"
        }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "app:app", 
        host="0.0.0.0", 
        port=port, 
        reload=True if os.getenv("ENVIRONMENT") != "production" else False
    )