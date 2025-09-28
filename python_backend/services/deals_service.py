from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, asc
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
from datetime import datetime

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models import Deal as DealModel, DealClick as DealClickModel, SocialShare as SocialShareModel, ShortUrl as ShortUrlModel
from models import DealResponse, DealCreate, DealClickCreate, SocialShareCreate, ShortUrlCreate
from utils.deal_validator import DealValidator

class DealsService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.validator = DealValidator()

    async def get_deals(
        self, 
        deal_type: Optional[str] = None,
        category: Optional[str] = None,
        store: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        only_approved: bool = True
    ) -> List[DealResponse]:
        """Get deals with optional filtering"""
        query = select(DealModel).where(
            and_(
                DealModel.is_active == True,
                # Apply mandatory field validation at database level
                DealModel.title.isnot(None),
                DealModel.title != '',
                DealModel.description.isnot(None), 
                DealModel.description != '',
                DealModel.original_price.isnot(None),
                DealModel.sale_price.isnot(None),
                DealModel.store.isnot(None),
                DealModel.store != '',
                DealModel.category.isnot(None),
                DealModel.category != '',
                DealModel.affiliate_url.isnot(None),
                DealModel.affiliate_url != '',
                DealModel.image_url.isnot(None),
                DealModel.image_url != ''
            )
        )
        
        if only_approved:
            query = query.where(DealModel.is_ai_approved == True)
        
        if deal_type:
            query = query.where(DealModel.deal_type == deal_type)
        
        if category:
            query = query.where(DealModel.category == category)
            
        if store:
            query = query.where(DealModel.store == store)
        
        # Order by popularity for 'top', created_at for others
        if deal_type == 'top':
            query = query.order_by(desc(DealModel.popularity), desc(DealModel.created_at))
        elif deal_type == 'hot':
            query = query.order_by(desc(DealModel.click_count), desc(DealModel.created_at))
        else:  # latest or no deal_type
            query = query.order_by(desc(DealModel.created_at))
        
        query = query.limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        deals = result.scalars().all()
        
        # Convert to response format (all deals should now be valid)
        valid_deals = []
        for deal in deals:
            # Sanitize and optimize the deal data
            deal_dict = {
                'title': deal.title,
                'description': deal.description,
                'original_price': deal.original_price,
                'sale_price': deal.sale_price,
                'store': deal.store,
                'category': deal.category,
                'affiliate_url': deal.affiliate_url,
                'image_url': deal.image_url
            }
            sanitized_deal_data = self.validator.sanitize_deal_data(deal_dict)
            
            # Update the deal with sanitized image URL (external, properly sized)
            deal.image_url = sanitized_deal_data.get('image_url', deal.image_url)
            
            # Ensure all required fields have proper defaults before validation
            deal_dict_for_response = {
                'id': deal.id,
                'title': deal.title,
                'description': deal.description,
                'original_price': float(deal.original_price),
                'sale_price': float(deal.sale_price),
                'discount_percentage': deal.discount_percentage,
                'image_url': deal.image_url,
                'affiliate_url': deal.affiliate_url,
                'store': deal.store,
                'store_logo_url': deal.store_logo_url,
                'category': deal.category,
                'rating': float(deal.rating) if deal.rating else None,
                'review_count': deal.review_count or 0,
                'expires_at': deal.expires_at,
                'is_active': deal.is_active,
                'is_ai_approved': deal.is_ai_approved or False,
                'ai_score': float(deal.ai_score) if deal.ai_score else 0.0,
                'popularity': deal.popularity or 0,
                'click_count': deal.click_count or 0,
                'share_count': deal.share_count or 0,
                'deal_type': deal.deal_type or 'latest',
                'coupon_code': deal.coupon_code,
                'coupon_required': deal.coupon_required or False,
                'created_at': deal.created_at,
                'updated_at': deal.updated_at
            }
            valid_deals.append(DealResponse.model_validate(deal_dict_for_response))
        
        return valid_deals

    async def get_deal_by_id(self, deal_id: str) -> Optional[DealResponse]:
        """Get a single deal by ID"""
        query = select(DealModel).where(DealModel.id == deal_id)
        result = await self.db.execute(query)
        deal = result.scalar_one_or_none()
        
        if deal:
            # Ensure all required fields have proper defaults before validation
            deal_dict = {
                'id': deal.id,
                'title': deal.title,
                'description': deal.description,
                'original_price': float(deal.original_price),
                'sale_price': float(deal.sale_price),
                'discount_percentage': deal.discount_percentage,
                'image_url': deal.image_url,
                'affiliate_url': deal.affiliate_url,
                'store': deal.store,
                'store_logo_url': deal.store_logo_url,
                'category': deal.category,
                'rating': float(deal.rating) if deal.rating else None,
                'review_count': deal.review_count or 0,
                'expires_at': deal.expires_at,
                'is_active': deal.is_active,
                'is_ai_approved': deal.is_ai_approved or False,
                'ai_score': float(deal.ai_score) if deal.ai_score else 0.0,
                'popularity': deal.popularity or 0,
                'click_count': deal.click_count or 0,
                'share_count': deal.share_count or 0,
                'deal_type': deal.deal_type or 'latest',
                'coupon_code': deal.coupon_code,
                'coupon_required': deal.coupon_required or False,
                'created_at': deal.created_at,
                'updated_at': deal.updated_at
            }
            return DealResponse.model_validate(deal_dict)
        return None

    async def create_deal(self, deal_data: DealCreate) -> DealResponse:
        """Create a new deal"""
        deal_dict = deal_data.model_dump()
        
        # Auto-calculate discount percentage if not provided
        if not deal_dict.get('discount_percentage'):
            original_price = float(deal_dict.get('original_price', 0))
            sale_price = float(deal_dict.get('sale_price', 0))
            if original_price > 0 and sale_price < original_price:
                deal_dict['discount_percentage'] = round(((original_price - sale_price) / original_price) * 100, 1)
            else:
                deal_dict['discount_percentage'] = 0
        
        deal = DealModel(
            id=str(uuid.uuid4()),
            **deal_dict
        )
        
        self.db.add(deal)
        await self.db.commit()
        await self.db.refresh(deal)
        
        return DealResponse.model_validate(deal)

    async def track_deal_click(self, deal_id: str, click_data: DealClickCreate) -> str:
        """Track a deal click and return the affiliate URL"""
        # First, get the deal
        deal = await self.get_deal_by_id(deal_id)
        if not deal:
            raise ValueError("Deal not found")
        
        # Create click record
        click = DealClickModel(
            id=str(uuid.uuid4()),
            deal_id=deal_id,
            ip_address=click_data.ip_address,
            user_agent=click_data.user_agent,
            referrer=click_data.referrer
        )
        
        # Update deal click count
        query = select(DealModel).where(DealModel.id == deal_id)
        result = await self.db.execute(query)
        deal_model = result.scalar_one_or_none()
        
        if deal_model:
            deal_model.click_count = (deal_model.click_count or 0) + 1
            deal_model.popularity = (deal_model.popularity or 0) + 1
        
        self.db.add(click)
        await self.db.commit()
        
        return deal.affiliate_url

    async def create_share_url(self, deal_id: str, share_data: SocialShareCreate) -> str:
        """Create a short URL for sharing a deal"""
        import random
        import string
        
        # Generate short code
        short_code = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
        # Create original URL pointing to deal page
        original_url = f"https://{os.getenv('REPLIT_DOMAINS', 'localhost:5000').split(',')[0]}/deals/{deal_id}"
        
        # Create short URL record
        short_url_record = ShortUrlModel(
            id=str(uuid.uuid4()),
            short_code=short_code,
            original_url=original_url,
            deal_id=deal_id
        )
        
        # Create share record with short URL
        share_data.short_url = f"https://{os.getenv('REPLIT_DOMAINS', 'localhost:5000').split(',')[0]}/s/{short_code}"
        share = SocialShareModel(
            id=str(uuid.uuid4()),
            **share_data.model_dump()
        )
        
        # Update deal share count
        query = select(DealModel).where(DealModel.id == deal_id)
        result = await self.db.execute(query)
        deal = result.scalar_one_or_none()
        
        if deal:
            deal.share_count = (deal.share_count or 0) + 1
            deal.popularity = (deal.popularity or 0) + 1
        
        self.db.add(short_url_record)
        self.db.add(share)
        await self.db.commit()
        
        return share_data.short_url
    
    async def resolve_short_url(self, short_code: str) -> str:
        """Resolve a short URL code to the original deal URL"""
        query = select(ShortUrlModel).where(ShortUrlModel.short_code == short_code)
        result = await self.db.execute(query)
        short_url = result.scalar_one_or_none()
        
        if not short_url:
            return None
            
        # Update click count
        short_url.click_count = (short_url.click_count or 0) + 1
        await self.db.commit()
        
        return short_url.original_url

    async def track_social_share(self, share_data: SocialShareCreate) -> bool:
        """Track a social share"""
        share = SocialShareModel(
            id=str(uuid.uuid4()),
            **share_data.model_dump()
        )
        
        # Update deal share count
        query = select(DealModel).where(DealModel.id == share_data.deal_id)
        result = await self.db.execute(query)
        deal_model = result.scalar_one_or_none()
        
        if deal_model:
            deal_model.share_count = (deal_model.share_count or 0) + 1
            deal_model.popularity = (deal_model.popularity or 0) + 2  # Shares count more than clicks
        
        self.db.add(share)
        await self.db.commit()
        
        return True

    async def approve_deal(self, deal_id: str) -> bool:
        """Approve a deal (admin only)"""
        query = select(DealModel).where(DealModel.id == deal_id)
        result = await self.db.execute(query)
        deal = result.scalar_one_or_none()
        
        if deal:
            deal.is_ai_approved = True
            await self.db.commit()
            return True
        return False

    async def get_pending_deals(self) -> List[DealResponse]:
        """Get deals pending approval (admin only)"""
        query = select(DealModel).where(
            and_(
                DealModel.is_active == True,
                DealModel.is_ai_approved == False
            )
        ).order_by(desc(DealModel.created_at))
        
        result = await self.db.execute(query)
        deals = result.scalars().all()
        
        return [DealResponse.model_validate(deal) for deal in deals]

    async def get_categories(self) -> List[str]:
        """Get all unique categories"""
        query = select(DealModel.category).distinct().where(
            and_(
                DealModel.is_active == True,
                DealModel.is_ai_approved == True
            )
        )
        result = await self.db.execute(query)
        categories = result.scalars().all()
        return sorted([cat for cat in categories if cat])

    async def get_stores(self) -> List[str]:
        """Get all unique stores"""
        query = select(DealModel.store).distinct().where(
            and_(
                DealModel.is_active == True,
                DealModel.is_ai_approved == True
            )
        )
        result = await self.db.execute(query)
        stores = result.scalars().all()
        return sorted([store for store in stores if store])