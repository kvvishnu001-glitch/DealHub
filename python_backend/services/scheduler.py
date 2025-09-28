"""
Background Task Scheduler for Automated Deal Fetching
Handles periodic deal fetching, cleanup, and maintenance tasks
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any
import schedule
import threading
import time
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, text

from database import get_db
from models import Deal
from services.deal_fetcher import run_deal_fetching_cycle

logger = logging.getLogger(__name__)

class DealScheduler:
    def __init__(self):
        self.running = False
        self.scheduler_thread = None
        
    async def start_scheduler(self):
        """Start the background scheduler"""
        if self.running:
            logger.warning("Scheduler already running")
            return
            
        self.running = True
        logger.info("Starting deal scheduler")
        
        # Schedule tasks
        schedule.every(4).hours.do(self._schedule_deal_fetch)
        schedule.every(1).hours.do(self._schedule_cleanup_rejected_deals)
        schedule.every(6).hours.do(self._schedule_update_deal_stats)
        schedule.every().day.at("02:00").do(self._schedule_daily_maintenance)
        
        # Start scheduler in background thread
        self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.scheduler_thread.start()
        
        logger.info("Deal scheduler started successfully")
        
    def stop_scheduler(self):
        """Stop the background scheduler"""
        self.running = False
        schedule.clear()
        logger.info("Deal scheduler stopped")
        
    def _run_scheduler(self):
        """Run the scheduler loop"""
        while self.running:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
            
    def _schedule_deal_fetch(self):
        """Schedule deal fetching task"""
        asyncio.create_task(self.fetch_deals_task())
        
    def _schedule_cleanup_rejected_deals(self):
        """Schedule cleanup of rejected deals"""
        asyncio.create_task(self.cleanup_rejected_deals())
        
    def _schedule_update_deal_stats(self):
        """Schedule deal statistics update"""
        asyncio.create_task(self.update_deal_statistics())
        
    def _schedule_daily_maintenance(self):
        """Schedule daily maintenance tasks"""
        asyncio.create_task(self.daily_maintenance())

    async def fetch_deals_task(self):
        """Automated deal fetching task"""
        try:
            logger.info("Starting scheduled deal fetching")
            result = await run_deal_fetching_cycle()
            
            logger.info(f"Deal fetching completed: {result}")
            
            # Log to database for tracking
            await self._log_task_result('deal_fetch', result)
            
        except Exception as e:
            logger.error(f"Error in scheduled deal fetching: {e}")
            await self._log_task_result('deal_fetch', {'error': str(e)})

    async def cleanup_rejected_deals(self):
        """Remove deals that have been rejected for more than 24 hours"""
        try:
            logger.info("Starting cleanup of rejected deals")
            
            # Calculate cutoff time (24 hours ago)
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            
            async with get_db() as db:
                # Find rejected deals older than 24 hours
                result = await db.execute(
                    select(Deal).where(
                        Deal.status == 'rejected',
                        Deal.updated_at < cutoff_time
                    )
                )
                old_rejected_deals = result.scalars().all()
                
                # Delete old rejected deals
                deleted_count = 0
                for deal in old_rejected_deals:
                    await db.delete(deal)
                    deleted_count += 1
                
                await db.commit()
                
                logger.info(f"Cleaned up {deleted_count} rejected deals")
                
                await self._log_task_result('cleanup_rejected', {
                    'deleted_count': deleted_count,
                    'cutoff_time': cutoff_time.isoformat()
                })
                
        except Exception as e:
            logger.error(f"Error in rejected deals cleanup: {e}")
            await self._log_task_result('cleanup_rejected', {'error': str(e)})

    async def update_deal_statistics(self):
        """Update deal statistics and quality scores"""
        try:
            logger.info("Starting deal statistics update")
            
            async with get_db() as db:
                # Update deal popularity scores based on clicks and shares
                await db.execute(text("""
                    UPDATE deals 
                    SET popularity_score = (
                        COALESCE(click_count, 0) * 1.0 + 
                        COALESCE(share_count, 0) * 2.0
                    ) / GREATEST(
                        EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0, 
                        1.0
                    )
                """))
                
                # Update deal freshness scores
                await db.execute(text("""
                    UPDATE deals 
                    SET freshness_score = GREATEST(
                        0, 
                        10 - EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0
                    )
                """))
                
                await db.commit()
                
                logger.info("Deal statistics updated successfully")
                await self._log_task_result('update_stats', {'status': 'completed'})
                
        except Exception as e:
            logger.error(f"Error updating deal statistics: {e}")
            await self._log_task_result('update_stats', {'error': str(e)})

    async def daily_maintenance(self):
        """Perform daily maintenance tasks"""
        try:
            logger.info("Starting daily maintenance")
            
            async with get_db() as db:
                # Remove very old deals (older than 30 days)
                cutoff_date = datetime.utcnow() - timedelta(days=30)
                
                result = await db.execute(
                    delete(Deal).where(Deal.created_at < cutoff_date)
                )
                
                deleted_count = result.rowcount
                
                # Clean up orphaned data
                await db.execute(text("VACUUM ANALYZE;"))
                
                await db.commit()
                
                logger.info(f"Daily maintenance completed. Removed {deleted_count} old deals")
                
                await self._log_task_result('daily_maintenance', {
                    'old_deals_removed': deleted_count,
                    'cutoff_date': cutoff_date.isoformat()
                })
                
        except Exception as e:
            logger.error(f"Error in daily maintenance: {e}")
            await self._log_task_result('daily_maintenance', {'error': str(e)})

    async def _log_task_result(self, task_name: str, result: Dict[str, Any]):
        """Log task results to database"""
        try:
            async with get_db() as db:
                await db.execute(text("""
                    INSERT INTO task_logs (task_name, result_data, executed_at)
                    VALUES (:task_name, :result_data, :executed_at)
                    ON CONFLICT DO NOTHING
                """), {
                    'task_name': task_name,
                    'result_data': str(result),
                    'executed_at': datetime.utcnow()
                })
                await db.commit()
        except Exception as e:
            logger.error(f"Error logging task result: {e}")

    async def manual_fetch_deals(self) -> Dict[str, Any]:
        """Manually trigger deal fetching (for admin use)"""
        try:
            logger.info("Manual deal fetch triggered")
            result = await run_deal_fetching_cycle()
            await self._log_task_result('manual_fetch', result)
            return result
        except Exception as e:
            error_result = {'error': str(e)}
            await self._log_task_result('manual_fetch', error_result)
            raise

    async def get_scheduler_status(self) -> Dict[str, Any]:
        """Get current scheduler status and recent task logs"""
        try:
            async with get_db() as db:
                # Get recent task logs
                result = await db.execute(text("""
                    SELECT task_name, result_data, executed_at 
                    FROM task_logs 
                    ORDER BY executed_at DESC 
                    LIMIT 20
                """))
                recent_logs = result.fetchall()
                
                return {
                    'running': self.running,
                    'next_scheduled_tasks': [
                        str(job) for job in schedule.jobs
                    ],
                    'recent_logs': [
                        {
                            'task': log[0],
                            'result': log[1],
                            'executed_at': log[2].isoformat() if log[2] else None
                        }
                        for log in recent_logs
                    ]
                }
                
        except Exception as e:
            logger.error(f"Error getting scheduler status: {e}")
            return {
                'running': self.running,
                'error': str(e)
            }


# Global scheduler instance
scheduler = DealScheduler()

async def start_background_scheduler():
    """Start the global scheduler"""
    await scheduler.start_scheduler()

def stop_background_scheduler():
    """Stop the global scheduler"""
    scheduler.stop_scheduler()