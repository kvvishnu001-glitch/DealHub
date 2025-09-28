#!/usr/bin/env python3

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import uvicorn
import os
from contextlib import asynccontextmanager
from pathlib import Path

# Simple imports without relative paths
from database import get_db, init_database
from models import Deal as DealModel
from routes.admin import router as admin_router

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
app.include_router(admin_router, prefix="/api")

# Include deals router
try:
    from routes.deals import router as deals_router
    app.include_router(deals_router, prefix="/api")
except ImportError as e:
    print(f"Warning: Could not import deals router: {e}")

# Include sample files router
from routes.sample_files import router as sample_files_router
app.include_router(sample_files_router, prefix="/api/admin/sample-files")

# Include file upload router
try:
    from routes.file_upload_simple import router as file_upload_router
    app.include_router(file_upload_router, prefix="/api/admin")
except ImportError as e:
    print(f"Warning: Could not import file upload router: {e}")

# Import and include automation router
try:
    from routes.automation import router as automation_router
    app.include_router(automation_router, prefix="/api")
except ImportError as e:
    print(f"Warning: Could not import automation router: {e}")

# Import and include affiliate management router
try:
    from routes.affiliate_management import router as affiliate_router
    app.include_router(affiliate_router, prefix="/api")
except ImportError as e:
    print(f"Warning: Could not import affiliate management router: {e}")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "DealSphere Python API is running"}

@app.get("/api/deals")
async def get_deals(db: AsyncSession = Depends(get_db)):
    try:
        # Only return active, approved deals for public website
        result = await db.execute(
            select(DealModel).where(
                DealModel.is_active == True,
                DealModel.is_ai_approved == True,
                DealModel.status == 'approved'
            ).order_by(DealModel.created_at.desc())
        )
        deals = result.scalars().all()
        
        # Convert to dict format for JSON response
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
                "rating": str(deal.rating) if deal.rating else None,
                "reviewCount": deal.review_count,
                "expiresAt": deal.expires_at.isoformat() if deal.expires_at else None,
                "isActive": deal.is_active,
                "isAiApproved": deal.is_ai_approved,
                "aiScore": str(deal.ai_score) if deal.ai_score else None,
                "aiReasons": deal.ai_reasons,
                "popularity": deal.popularity,
                "clickCount": deal.click_count,
                "shareCount": deal.share_count,
                "dealType": deal.deal_type,
                "sourceApi": deal.source_api,
                "createdAt": deal.created_at.isoformat() if deal.created_at else None,
                "updatedAt": deal.updated_at.isoformat() if deal.updated_at else None
            }
            deals_list.append(deal_dict)
        
        return deals_list
    except Exception as e:
        print(f"Error fetching deals: {e}")
        return []

@app.post("/api/deals/{deal_id}/click")
async def track_deal_click(deal_id: str, db: AsyncSession = Depends(get_db)):
    try:
        # Get deal
        result = await db.execute(select(DealModel).where(DealModel.id == deal_id))
        deal = result.scalar_one_or_none()
        
        if not deal:
            return {"error": "Deal not found"}
        
        # Increment click count
        deal.click_count = (deal.click_count or 0) + 1
        await db.commit()
        
        return {"affiliateUrl": deal.affiliate_url}
    except Exception as e:
        print(f"Error tracking click: {e}")
        return {"error": "Failed to track click"}

@app.post("/api/deals/{deal_id}/share")
async def create_share_url(deal_id: str, platform: str = "general", db: AsyncSession = Depends(get_db)):
    """Create short URL for sharing and track social share"""
    try:
        from services.deals_service import DealsService
        from models import SocialShareCreate
        
        deals_service = DealsService(db)
        
        share_data = SocialShareCreate(
            deal_id=deal_id,
            platform=platform,
            ip_address="127.0.0.1"  # Default for simple server
        )
        
        short_url = await deals_service.create_share_url(deal_id, share_data)
        
        if not short_url:
            raise HTTPException(status_code=400, detail="Failed to create share URL")
        
        return {"shortUrl": short_url}
    except Exception as e:
        print(f"Error creating share URL: {e}")
        return {"error": "Failed to create share URL"}

@app.get("/s/{short_code}")
async def redirect_short_url(short_code: str, db: AsyncSession = Depends(get_db)):
    """Redirect short URL to deal page"""
    try:
        from services.deals_service import DealsService
        
        deals_service = DealsService(db)
        deal_url = await deals_service.resolve_short_url(short_code)
        
        if not deal_url:
            raise HTTPException(status_code=404, detail="Short URL not found")
        
        # Redirect to the deal page
        return RedirectResponse(url=deal_url, status_code=302)
    except Exception as e:
        print(f"Error resolving short URL: {e}")
        raise HTTPException(status_code=404, detail="Short URL not found")

# Serve static files for frontend (when built)
frontend_dist_path = Path("../client/dist")
if frontend_dist_path.exists():
    app.mount("/assets", StaticFiles(directory="../client/dist/assets"), name="assets")
    
    # Handle deal pages with Open Graph meta tags for social sharing
    @app.api_route("/deals/{deal_id}", methods=["GET", "HEAD"])
    async def serve_deal_page(deal_id: str, request: Request, db: AsyncSession = Depends(get_db)):
        """Serve deal page with Open Graph meta tags for rich social sharing"""
        try:
            # Get deal data
            result = await db.execute(select(DealModel).where(DealModel.id == deal_id))
            deal = result.scalar_one_or_none()
            
            # Read the base HTML template
            html_path = "../client/dist/index.html"
            with open(html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            if deal:
                # Get base URL for absolute URLs
                base_url = str(request.base_url).rstrip('/')
                
                # Create Open Graph meta tags
                og_title = f"{deal.title} - {deal.discount_percentage}% OFF"
                og_description = deal.description or f"Get {deal.title} for just ${deal.sale_price} (was ${deal.original_price}). Save ${float(deal.original_price) - float(deal.sale_price):.2f}!"
                og_image = deal.image_url or "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=630&fit=crop"
                og_url = f"{base_url}/deals/{deal_id}"
                
                # Insert Open Graph meta tags into the HTML
                meta_tags = f'''
    <!-- Open Graph Meta Tags for Social Sharing -->
    <meta property="og:title" content="{og_title.replace('"', '&quot;')}" />
    <meta property="og:description" content="{og_description.replace('"', '&quot;')}" />
    <meta property="og:image" content="{og_image}" />
    <meta property="og:url" content="{og_url}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="DealSphere" />
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{og_title.replace('"', '&quot;')}" />
    <meta name="twitter:description" content="{og_description.replace('"', '&quot;')}" />
    <meta name="twitter:image" content="{og_image}" />
    
    <!-- Additional Meta Tags -->
    <meta name="description" content="{og_description.replace('"', '&quot;')}" />
    <title>{og_title.replace('"', '&quot;')}</title>
'''
                
                # Insert meta tags before closing </head> tag
                html_content = html_content.replace('</head>', f'{meta_tags}</head>')
            
            return Response(content=html_content, media_type="text/html")
        except Exception as e:
            print(f"Error serving deal page: {e}")
            return FileResponse("../client/dist/index.html")
    
    # Specific route for admin
    @app.get("/admin")
    async def serve_admin():
        return FileResponse("../client/dist/index.html")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # API routes should not be caught here
        if full_path.startswith("api/") or full_path.startswith("s/"):
            raise HTTPException(status_code=404, detail="Not found")
        
        # Serve index.html for all frontend routes
        return FileResponse("../client/dist/index.html")
else:
    @app.get("/")
    async def root():
        return {"message": "DealSphere Python API is running", "status": "healthy", "note": "Frontend not built"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    uvicorn.run(
        "simple_server:app", 
        host="0.0.0.0", 
        port=port, 
        reload=True
    )