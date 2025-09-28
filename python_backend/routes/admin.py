from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, desc, select
from datetime import datetime, timedelta
from typing import List
import uuid

from database import get_db
from models import (
    Deal, AdminUser, DealClick, SocialShare,
    AdminUserCreate, AdminUserLogin, AdminUserResponse, AdminMetrics,
    DealCreate, DealResponse
)
from admin_auth import (
    authenticate_admin, create_access_token, get_current_admin,
    create_admin_user
)

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/register", response_model=AdminUserResponse)
async def register_admin(admin_data: AdminUserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new admin user"""
    try:
        admin = await create_admin_user(admin_data.username, admin_data.email, admin_data.password, db)
        return admin
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login")
async def login_admin(login_data: AdminUserLogin, db: AsyncSession = Depends(get_db)):
    """Admin login endpoint"""
    admin = await authenticate_admin(login_data.username, login_data.password, db)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token = create_access_token(data={"sub": admin.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "admin": AdminUserResponse.model_validate(admin)
    }

@router.get("/me", response_model=AdminUserResponse)
async def get_current_admin_info(current_admin: AdminUser = Depends(get_current_admin)):
    """Get current admin user information"""
    return current_admin

@router.get("/metrics", response_model=AdminMetrics)
async def get_admin_metrics(
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get admin dashboard metrics"""
    
    # Basic counts
    total_deals_result = await db.execute(select(func.count(Deal.id)))
    total_deals = total_deals_result.scalar() or 0
    
    ai_approved_result = await db.execute(select(func.count(Deal.id)).where(Deal.is_ai_approved == True))
    ai_approved_deals = ai_approved_result.scalar() or 0
    
    pending_result = await db.execute(select(func.count(Deal.id)).where(Deal.is_ai_approved == False))
    pending_deals = pending_result.scalar() or 0
    
    # Click and share counts
    clicks_result = await db.execute(select(func.sum(Deal.click_count)))
    total_clicks = clicks_result.scalar() or 0
    
    shares_result = await db.execute(select(func.sum(Deal.share_count)))
    total_shares = shares_result.scalar() or 0
    
    # Revenue estimate (assuming $0.05 per click)
    revenue_estimate = float(total_clicks) * 0.05
    
    # Top categories
    top_categories_result = await db.execute(
        select(
            Deal.category,
            func.count(Deal.id).label('count'),
            func.sum(Deal.click_count).label('clicks')
        ).group_by(Deal.category).order_by(desc('count')).limit(5)
    )
    top_categories = top_categories_result.all()
    
    top_categories_list = [
        {
            "category": cat.category,
            "deals_count": cat.count,
            "clicks": cat.clicks or 0
        }
        for cat in top_categories
    ]
    
    # Top stores
    top_stores_result = await db.execute(
        select(
            Deal.store,
            func.count(Deal.id).label('count'),
            func.sum(Deal.click_count).label('clicks')
        ).group_by(Deal.store).order_by(desc('count')).limit(5)
    )
    top_stores = top_stores_result.all()
    
    top_stores_list = [
        {
            "store": store.store,
            "deals_count": store.count,
            "clicks": store.clicks or 0
        }
        for store in top_stores
    ]
    
    # Recent activity (last 10 deals)
    recent_deals_result = await db.execute(select(Deal).order_by(desc(Deal.created_at)).limit(10))
    recent_deals = recent_deals_result.scalars().all()
    
    recent_activity = [
        {
            "id": deal.id,
            "title": deal.title,
            "store": deal.store,
            "category": deal.category,
            "created_at": deal.created_at.isoformat(),
            "clicks": deal.click_count,
            "ai_approved": deal.is_ai_approved
        }
        for deal in recent_deals
    ]
    
    return AdminMetrics(
        total_deals=total_deals,
        ai_approved_deals=ai_approved_deals,
        pending_deals=pending_deals,
        total_clicks=total_clicks,
        total_shares=total_shares,
        revenue_estimate=revenue_estimate,
        top_categories=top_categories_list,
        top_stores=top_stores_list,
        recent_activity=recent_activity
    )

@router.get("/deals", response_model=List[DealResponse])
async def get_all_deals(
    skip: int = 0,
    limit: int = 50,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all deals for admin management"""
    result = await db.execute(select(Deal).order_by(desc(Deal.created_at)).offset(skip).limit(limit))
    deals = result.scalars().all()
    return deals

@router.post("/deals", response_model=DealResponse)
async def create_deal(
    deal_data: DealCreate,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new deal"""
    deal = Deal(
        id=str(uuid.uuid4()),
        **deal_data.model_dump()
    )
    
    db.add(deal)
    await db.commit()
    await db.refresh(deal)
    return deal

@router.patch("/deals/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: str,
    deal_data: DealCreate,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update an existing deal"""
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    for field, value in deal_data.model_dump(exclude_unset=True).items():
        setattr(deal, field, value)
    
    await db.commit()
    await db.refresh(deal)
    return deal

@router.patch("/deals/{deal_id}/approve")
async def approve_deal(
    deal_id: str,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Approve a deal"""
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    deal.is_ai_approved = True
    deal.status = "approved"
    deal.updated_at = datetime.utcnow()
    
    await db.commit()
    return {"message": "Deal approved successfully"}

@router.patch("/deals/{deal_id}/reject")
async def reject_deal(
    deal_id: str,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Reject a deal (will be auto-deleted after 24 hours)"""
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    deal.is_ai_approved = False
    deal.status = "rejected"
    deal.updated_at = datetime.utcnow()
    
    await db.commit()
    return {"message": "Deal rejected and will be deleted in 24 hours"}

@router.delete("/deals/{deal_id}")
async def delete_deal(
    deal_id: str,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Permanently delete a deal"""
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    await db.delete(deal)
    await db.commit()
    return {"message": "Deal deleted successfully"}

@router.put("/deals/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: str,
    deal_data: DealCreate,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update an existing deal"""
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    for field, value in deal_data.model_dump().items():
        setattr(deal, field, value)
    
    deal.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(deal)
    return deal

@router.delete("/deals/{deal_id}")
async def delete_deal(
    deal_id: str,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a deal"""
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Soft delete - remove from public immediately
    deal.status = 'deleted'
    deal.is_active = False
    deal.deleted_at = datetime.utcnow()
    deal.updated_at = datetime.utcnow()
    
    await db.commit()
    return {"message": "Deal deleted and removed from website"}

@router.patch("/deals/{deal_id}/approve")
async def approve_deal(
    deal_id: str,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Approve a deal - makes it live on public website"""
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Approve deal - make it live
    deal.is_ai_approved = True
    deal.status = 'approved'
    deal.is_active = True
    deal.updated_at = datetime.utcnow()
    
    await db.commit()
    return {"message": "Deal approved and is now live on website"}

@router.patch("/deals/{deal_id}/reject")
async def reject_deal(
    deal_id: str,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Reject a deal - removes from public immediately, schedules deletion"""
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Reject deal - remove from public immediately
    deal.is_ai_approved = False
    deal.status = 'rejected'
    deal.is_active = False  # Remove from public website immediately
    deal.rejected_at = datetime.utcnow()
    deal.updated_at = datetime.utcnow()
    
    await db.commit()
    return {"message": "Deal rejected and removed from website"}

@router.get("/deals/search")
async def search_deals(
    q: str = "",
    category: str = "",
    store: str = "",
    status: str = "",
    skip: int = 0,
    limit: int = 50,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Search and filter deals with advanced options"""
    query = select(Deal)
    
    # Apply filters
    if q:
        query = query.where(Deal.title.ilike(f"%{q}%"))
    if category:
        query = query.where(Deal.category == category)
    if store:
        query = query.where(Deal.store == store)
    if status:
        query = query.where(Deal.status == status)
    
    # Order by created date and apply pagination
    query = query.order_by(desc(Deal.created_at)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    deals = result.scalars().all()
    
    return deals

@router.get("/deals/categories")
async def get_categories(
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all unique categories"""
    result = await db.execute(select(Deal.category).distinct())
    categories = [row[0] for row in result.all()]
    return {"categories": categories}

@router.get("/deals/stores")
async def get_stores(
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all unique stores"""
    result = await db.execute(select(Deal.store).distinct())
    stores = [row[0] for row in result.all()]
    return {"stores": stores}

@router.post("/cleanup/rejected-deals")
async def cleanup_rejected_deals(
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete rejected deals older than 1 day"""
    cutoff_date = datetime.utcnow() - timedelta(days=1)
    
    # Find rejected deals older than 1 day
    result = await db.execute(
        select(Deal).where(
            Deal.status == 'rejected',
            Deal.rejected_at < cutoff_date
        )
    )
    old_rejected_deals = result.scalars().all()
    
    # Delete them permanently
    for deal in old_rejected_deals:
        await db.delete(deal)
    
    await db.commit()
    
    return {"message": f"Cleaned up {len(old_rejected_deals)} old rejected deals"}