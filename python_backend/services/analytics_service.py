from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models import Deal as DealModel, DealClick as DealClickModel
from models import Analytics

class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_analytics(self) -> Analytics:
        """Get dashboard analytics"""
        # Total deals
        total_deals_query = select(func.count(DealModel.id)).where(DealModel.is_active == True)
        total_deals_result = await self.db.execute(total_deals_query)
        total_deals = total_deals_result.scalar() or 0

        # AI approved deals
        ai_approved_query = select(func.count(DealModel.id)).where(
            and_(
                DealModel.is_active == True,
                DealModel.is_ai_approved == True
            )
        )
        ai_approved_result = await self.db.execute(ai_approved_query)
        ai_approved = ai_approved_result.scalar() or 0

        # Pending review deals
        pending_review = total_deals - ai_approved

        # Clicks today
        today = datetime.utcnow().date()
        tomorrow = today + timedelta(days=1)
        
        clicks_today_query = select(func.count(DealClickModel.id)).where(
            and_(
                DealClickModel.clicked_at >= today,
                DealClickModel.clicked_at < tomorrow
            )
        )
        clicks_today_result = await self.db.execute(clicks_today_query)
        clicks_today = clicks_today_result.scalar() or 0

        return Analytics(
            total_deals=total_deals,
            ai_approved=ai_approved,
            pending_review=pending_review,
            clicks_today=clicks_today
        )