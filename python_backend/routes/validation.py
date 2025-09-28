"""
Deal Validation Routes
Provides validation endpoints for checking deal completeness and compliance
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
import logging

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from database import get_db
from utils.deal_validator import DealValidator
from services.deals_service import DealsService

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/validation/deals/summary")
async def get_deals_validation_summary(db: AsyncSession = Depends(get_db)):
    """Get validation summary for all deals"""
    try:
        deals_service = DealsService(db)
        validator = DealValidator()
        
        # Get all deals (including non-approved ones for admin validation)
        all_deals = await deals_service.get_deals(limit=1000, only_approved=False)
        
        # Convert to dict format for validation
        deal_dicts = []
        for deal in all_deals:
            deal_dict = {
                'id': deal.id,
                'title': deal.title,
                'description': deal.description,
                'original_price': deal.originalPrice,
                'sale_price': deal.salePrice,
                'store': deal.store,
                'category': deal.category,
                'affiliate_url': deal.affiliateUrl,
                'image_url': deal.imageUrl
            }
            deal_dicts.append(deal_dict)
        
        # Get validation summary
        summary = validator.get_validation_summary(deal_dicts)
        
        return {
            "validation_summary": summary,
            "compliance_status": "compliant" if summary["validation_rate"] > 95 else "needs_attention",
            "recommendations": _get_validation_recommendations(summary)
        }
        
    except Exception as e:
        logger.error(f"Error getting validation summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to get validation summary")

@router.post("/validation/deals/validate")
async def validate_deal_data(deal_data: Dict[str, Any]):
    """Validate a single deal's data completeness"""
    try:
        validator = DealValidator()
        validation_result = validator.validate_deal_completeness(deal_data)
        
        # Add sanitized data if valid
        if validation_result['is_valid']:
            validation_result['sanitized_data'] = validator.sanitize_deal_data(deal_data)
        
        return validation_result
        
    except Exception as e:
        logger.error(f"Error validating deal data: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate deal data")

@router.get("/validation/deals/invalid")
async def get_invalid_deals(db: AsyncSession = Depends(get_db)):
    """Get list of deals that don't meet mandatory field requirements"""
    try:
        deals_service = DealsService(db)
        validator = DealValidator()
        
        # Get all deals
        all_deals = await deals_service.get_deals(limit=1000, only_approved=False)
        
        invalid_deals = []
        for deal in all_deals:
            deal_dict = {
                'id': deal.id,
                'title': deal.title,
                'description': deal.description,
                'original_price': deal.originalPrice,
                'sale_price': deal.salePrice,
                'store': deal.store,
                'category': deal.category,
                'affiliate_url': deal.affiliateUrl,
                'image_url': deal.imageUrl
            }
            
            validation = validator.validate_deal_completeness(deal_dict)
            if not validation['is_valid']:
                invalid_deals.append({
                    'deal': deal_dict,
                    'validation_errors': validation
                })
        
        return {
            "invalid_deals": invalid_deals,
            "total_invalid": len(invalid_deals),
            "compliance_action_required": len(invalid_deals) > 0
        }
        
    except Exception as e:
        logger.error(f"Error getting invalid deals: {e}")
        raise HTTPException(status_code=500, detail="Failed to get invalid deals")

@router.get("/validation/compliance/status")
async def get_compliance_status(db: AsyncSession = Depends(get_db)):
    """Get overall compliance status for the platform"""
    try:
        deals_service = DealsService(db)
        validator = DealValidator()
        
        # Get deals validation stats
        all_deals = await deals_service.get_deals(limit=1000, only_approved=False)
        
        # Compliance checks
        compliance_status = {
            "total_deals": len(all_deals),
            "image_compliance": {"external_images": 0, "violations": []},
            "field_completeness": {"complete_deals": 0, "incomplete_deals": 0},
            "affiliate_compliance": {"valid_urls": 0, "invalid_urls": 0},
            "overall_status": "compliant"
        }
        
        for deal in all_deals:
            # Check image compliance (must be external URLs)
            if deal.imageUrl:
                if deal.imageUrl.startswith(('http://', 'https://')):
                    compliance_status["image_compliance"]["external_images"] += 1
                else:
                    compliance_status["image_compliance"]["violations"].append({
                        "deal_id": deal.id,
                        "issue": "Local image storage (violates operating agreements)"
                    })
            
            # Check field completeness
            deal_dict = {
                'title': deal.title,
                'description': deal.description,
                'original_price': deal.originalPrice,
                'sale_price': deal.salePrice,
                'store': deal.store,
                'category': deal.category,
                'affiliate_url': deal.affiliateUrl,
                'image_url': deal.imageUrl
            }
            
            validation = validator.validate_deal_completeness(deal_dict)
            if validation['is_valid']:
                compliance_status["field_completeness"]["complete_deals"] += 1
            else:
                compliance_status["field_completeness"]["incomplete_deals"] += 1
            
            # Check affiliate URL compliance
            if deal.affiliateUrl and deal.affiliateUrl.startswith(('http://', 'https://')):
                compliance_status["affiliate_compliance"]["valid_urls"] += 1
            else:
                compliance_status["affiliate_compliance"]["invalid_urls"] += 1
        
        # Determine overall status
        if (compliance_status["image_compliance"]["violations"] or 
            compliance_status["field_completeness"]["incomplete_deals"] > 0 or
            compliance_status["affiliate_compliance"]["invalid_urls"] > 0):
            compliance_status["overall_status"] = "violations_detected"
        
        return compliance_status
        
    except Exception as e:
        logger.error(f"Error getting compliance status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get compliance status")

def _get_validation_recommendations(summary: Dict[str, Any]) -> List[str]:
    """Generate recommendations based on validation summary"""
    recommendations = []
    
    if summary["validation_rate"] < 95:
        recommendations.append(f"Improve deal validation: {summary['validation_rate']:.1f}% of deals are complete")
    
    issues = summary.get("issues", {})
    
    # Missing fields recommendations
    missing_fields = issues.get("missing_fields", {})
    if missing_fields:
        top_missing = sorted(missing_fields.items(), key=lambda x: x[1], reverse=True)[:3]
        for field, count in top_missing:
            recommendations.append(f"Fix {count} deals missing '{field}' field")
    
    # Field errors recommendations
    field_errors = issues.get("field_errors", {})
    if field_errors:
        top_errors = sorted(field_errors.items(), key=lambda x: x[1], reverse=True)[:3]
        for error, count in top_errors:
            recommendations.append(f"Resolve {count} deals with: {error}")
    
    # Image compliance recommendations
    warnings = issues.get("warnings", {})
    image_warnings = {k: v for k, v in warnings.items() if 'image' in k.lower()}
    if image_warnings:
        recommendations.append("Ensure all images use external URLs (compliance requirement)")
    
    if not recommendations:
        recommendations.append("All deals meet mandatory field requirements")
    
    return recommendations