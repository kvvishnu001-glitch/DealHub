"""
Automation API Routes
Admin endpoints for managing automated deal fetching and AI validation
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from database import get_db
from admin_auth import get_current_admin
from models import AdminUser
from services.scheduler import scheduler
from services.deal_fetcher import run_deal_fetching_cycle

router = APIRouter(prefix="/admin/automation", tags=["automation"])

@router.get("/status")
async def get_automation_status(
    current_admin: AdminUser = Depends(get_current_admin)
) -> Dict[str, Any]:
    """Get current automation status and recent activity"""
    try:
        status = await scheduler.get_scheduler_status()
        
        # Add configuration status
        import os
        config_status = {
            'amazon_configured': bool(os.getenv('AWS_ACCESS_KEY_ID') and 
                                    os.getenv('AWS_SECRET_ACCESS_KEY') and 
                                    os.getenv('AMAZON_ASSOCIATE_TAG')),
            'cj_configured': bool(os.getenv('CJ_DEVELOPER_KEY')),
            'clickbank_configured': bool(os.getenv('CLICKBANK_CLIENT_ID') and 
                                       os.getenv('CLICKBANK_DEVELOPER_KEY')),
            'openai_configured': bool(os.getenv('OPENAI_API_KEY'))
        }
        
        status['api_configurations'] = config_status
        return status
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting automation status: {str(e)}")

@router.post("/fetch-deals")
async def trigger_manual_fetch(
    current_admin: AdminUser = Depends(get_current_admin)
) -> Dict[str, Any]:
    """Manually trigger deal fetching from all sources"""
    try:
        result = await scheduler.manual_fetch_deals()
        return {
            "status": "success",
            "message": "Deal fetching completed",
            "details": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error triggering deal fetch: {str(e)}")

@router.post("/start-scheduler")
async def start_automation(
    current_admin: AdminUser = Depends(get_current_admin)
) -> Dict[str, str]:
    """Start the automated deal fetching scheduler"""
    try:
        await scheduler.start_scheduler()
        return {"status": "success", "message": "Automation scheduler started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting scheduler: {str(e)}")

@router.post("/stop-scheduler")
async def stop_automation(
    current_admin: AdminUser = Depends(get_current_admin)
) -> Dict[str, str]:
    """Stop the automated deal fetching scheduler"""
    try:
        scheduler.stop_scheduler()
        return {"status": "success", "message": "Automation scheduler stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error stopping scheduler: {str(e)}")

@router.post("/cleanup-rejected")
async def trigger_cleanup(
    current_admin: AdminUser = Depends(get_current_admin)
) -> Dict[str, str]:
    """Manually trigger cleanup of rejected deals"""
    try:
        await scheduler.cleanup_rejected_deals()
        return {"status": "success", "message": "Rejected deals cleanup completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during cleanup: {str(e)}")

@router.get("/configuration-help")
async def get_configuration_help(
    current_admin: AdminUser = Depends(get_current_admin)
) -> Dict[str, Any]:
    """Get help information for configuring affiliate APIs"""
    return {
        "amazon_associate": {
            "description": "Amazon Product Advertising API for fetching Amazon deals",
            "required_env_vars": [
                "AWS_ACCESS_KEY_ID",
                "AWS_SECRET_ACCESS_KEY", 
                "AMAZON_ASSOCIATE_TAG"
            ],
            "signup_url": "https://affiliate-program.amazon.com/",
            "api_docs": "https://webservices.amazon.com/paapi5/documentation/"
        },
        "commission_junction": {
            "description": "CJ Affiliate Network for fetching deals from multiple retailers",
            "required_env_vars": [
                "CJ_DEVELOPER_KEY",
                "CJ_WEBSITE_ID"
            ],
            "signup_url": "https://www.cj.com/",
            "api_docs": "https://developers.cj.com/"
        },
        "clickbank": {
            "description": "ClickBank marketplace for digital products and services",
            "required_env_vars": [
                "CLICKBANK_CLIENT_ID",
                "CLICKBANK_DEVELOPER_KEY",
                "CLICKBANK_NICKNAME"
            ],
            "signup_url": "https://www.clickbank.com/",
            "api_docs": "https://developers.clickbank.com/"
        },
        "openai": {
            "description": "OpenAI API for AI-powered deal validation and enhancement",
            "required_env_vars": [
                "OPENAI_API_KEY"
            ],
            "signup_url": "https://platform.openai.com/",
            "api_docs": "https://platform.openai.com/docs/"
        },
        "setup_instructions": {
            "step1": "Sign up for affiliate programs and get API credentials",
            "step2": "Set environment variables in Replit Secrets",
            "step3": "Test configuration using /automation/status endpoint",
            "step4": "Start automated fetching with /automation/start-scheduler",
            "note": "Each API has different approval requirements and rate limits"
        }
    }