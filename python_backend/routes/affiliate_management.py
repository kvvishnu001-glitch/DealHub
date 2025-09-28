"""
Affiliate Network Management API Routes
Admin endpoints for configuring and managing affiliate networks
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete
from typing import List, Dict, Any
import json
from datetime import datetime

from database import get_db
from admin_auth import get_current_admin
from models import (
    AdminUser, AffiliateNetwork, AffiliateConfig, ComplianceLog,
    AffiliateNetworkCreate, AffiliateConfigCreate, AffiliateConfigResponse
)
from services.affiliate_networks import AffiliateNetworkManager

router = APIRouter(prefix="/admin/affiliates", tags=["affiliate_management"])

@router.get("/networks")
async def get_all_networks(
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get all available affiliate networks with their configurations"""
    
    # Get network configurations
    result = await db.execute(select(AffiliateConfig))
    configs = result.scalars().all()
    
    # Create network manager to get available networks
    async with AffiliateNetworkManager() as manager:
        available_networks = manager.networks
        
        networks = []
        for network_id, network_info in available_networks.items():
            # Find existing config
            config = next((c for c in configs if c.network_id == network_id), None)
            
            network_data = {
                'network_id': network_id,
                'name': network_info['name'],
                'type': network_info['type'],
                'compliance_terms': network_info['compliance_terms'],
                'is_configured': config is not None,
                'is_active': config.is_active if config else False,
                'last_sync': config.last_sync.isoformat() if config and config.last_sync else None,
                'configuration_fields': _get_required_fields(network_id)
            }
            networks.append(network_data)
            
    return networks

@router.get("/networks/{network_id}")
async def get_network_config(
    network_id: str,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get configuration for a specific network"""
    
    result = await db.execute(
        select(AffiliateConfig).where(AffiliateConfig.network_id == network_id)
    )
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="Network configuration not found")
    
    # Remove sensitive data for response
    safe_config = config.config_data.copy()
    for key in safe_config:
        if any(sensitive in key.lower() for sensitive in ['key', 'secret', 'token', 'password']):
            safe_config[key] = '***HIDDEN***'
    
    return {
        'network_id': config.network_id,
        'network_name': config.network_name,
        'config_data': safe_config,
        'compliance_terms': config.compliance_terms,
        'is_active': config.is_active,
        'last_sync': config.last_sync.isoformat() if config.last_sync else None
    }

@router.post("/networks/{network_id}/configure")
async def configure_network(
    network_id: str,
    config_data: Dict[str, Any],
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Configure or update an affiliate network"""
    
    try:
        async with AffiliateNetworkManager() as manager:
            if network_id not in manager.networks:
                raise HTTPException(status_code=400, detail="Invalid network ID")
            
            network_info = manager.networks[network_id]
            
            # Validate required fields
            required_fields = _get_required_fields(network_id)
            missing_fields = [field for field in required_fields if field not in config_data]
            
            if missing_fields:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Missing required fields: {', '.join(missing_fields)}"
                )
            
            # Save configuration
            await manager.save_network_config(network_id, config_data, db)
            
        return {"status": "success", "message": f"{network_info['name']} configured successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error configuring network {network_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/networks/{network_id}/test")
async def test_network_connection(
    network_id: str,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Test connection to an affiliate network"""
    
    try:
        async with AffiliateNetworkManager() as manager:
            config = await manager.get_network_config(network_id, db)
            if not config:
                raise HTTPException(status_code=400, detail="Network not configured")
            
            # Test connection by validating credentials and fetching deals
            try:
                if network_id == 'amazon':
                    deals = await manager.fetch_amazon_deals(config)
                elif network_id == 'shareasale':
                    deals = await manager.fetch_shareasale_deals(config)
                elif network_id == 'rakuten':
                    deals = await manager.fetch_rakuten_deals(config)
                elif network_id == 'impact':
                    deals = await manager.fetch_impact_deals(config)
                elif network_id == 'partnerize':
                    deals = await manager.fetch_partnerize_deals(config)
                elif network_id == 'avantlink':
                    deals = await manager.fetch_avantlink_deals(config)
                elif network_id == 'awin':
                    deals = await manager.fetch_awin_deals(config)
                else:
                    raise ValueError(f"Unsupported network: {network_id}")
                
                return {
                    "status": "success",
                    "connection": "working",
                    "deals_found": len(deals),
                    "test_timestamp": datetime.utcnow().isoformat()
                }
                
            except ValueError as ve:
                # Validation errors should be returned as connection failures
                return {
                    "status": "error",
                    "connection": "failed",
                    "error_message": str(ve),
                    "test_timestamp": datetime.utcnow().isoformat()
                }
            
    except Exception as e:
        return {
            "status": "error",
            "connection": "failed",
            "error_message": str(e),
            "test_timestamp": datetime.utcnow().isoformat()
        }

@router.post("/networks/{network_id}/toggle")
async def toggle_network_status(
    network_id: str,
    enable: bool,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Enable or disable an affiliate network"""
    
    result = await db.execute(
        select(AffiliateConfig).where(AffiliateConfig.network_id == network_id)
    )
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="Network configuration not found")
    
    await db.execute(
        update(AffiliateConfig)
        .where(AffiliateConfig.network_id == network_id)
        .values(is_active=enable)
    )
    await db.commit()
    
    status = "enabled" if enable else "disabled"
    return {"status": "success", "message": f"Network {status} successfully"}

@router.delete("/networks/{network_id}")
async def delete_network_config(
    network_id: str,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Delete network configuration"""
    
    await db.execute(
        delete(AffiliateConfig).where(AffiliateConfig.network_id == network_id)
    )
    await db.commit()
    
    return {"status": "success", "message": "Network configuration deleted"}

@router.get("/compliance/{network_id}")
async def get_compliance_info(
    network_id: str,
    current_admin: AdminUser = Depends(get_current_admin)
) -> Dict[str, Any]:
    """Get compliance information for a network"""
    
    async with AffiliateNetworkManager() as manager:
        if network_id not in manager.networks:
            raise HTTPException(status_code=404, detail="Network not found")
        
        network_info = manager.networks[network_id]
        compliance_terms = network_info['compliance_terms']
        
        return {
            'network_id': network_id,
            'network_name': network_info['name'],
            'compliance_terms': compliance_terms,
            'requirements': _get_compliance_requirements(compliance_terms),
            'best_practices': _get_compliance_best_practices(network_id)
        }

@router.get("/compliance/logs")
async def get_compliance_logs(
    limit: int = 100,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get recent compliance check logs"""
    
    result = await db.execute(
        select(ComplianceLog)
        .order_by(ComplianceLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    
    return [
        {
            'id': log.id,
            'deal_id': log.deal_id,
            'network_id': log.network_id,
            'is_compliant': log.is_compliant,
            'issues_found': log.issues_found,
            'created_at': log.created_at.isoformat()
        }
        for log in logs
    ]

@router.post("/bulk-configure")
async def bulk_configure_networks(
    configurations: Dict[str, Dict[str, Any]],
    current_admin: AdminUser = Depends(get_current_admin)
) -> Dict[str, Any]:
    """Configure multiple networks at once"""
    
    results = {}
    async with AffiliateNetworkManager() as manager:
        for network_id, config_data in configurations.items():
            try:
                if network_id in manager.networks:
                    await manager.save_network_config(network_id, config_data)
                    results[network_id] = {"status": "success", "message": "Configured successfully"}
                else:
                    results[network_id] = {"status": "error", "message": "Invalid network ID"}
            except Exception as e:
                results[network_id] = {"status": "error", "message": str(e)}
    
    return {
        "overall_status": "completed",
        "results": results,
        "successful": len([r for r in results.values() if r["status"] == "success"]),
        "failed": len([r for r in results.values() if r["status"] == "error"])
    }

def _get_required_fields(network_id: str) -> List[str]:
    """Get required configuration fields for each network"""
    
    field_mappings = {
        'amazon': ['aws_access_key_id', 'aws_secret_access_key', 'associate_tag'],
        'cj': ['developer_key', 'website_id'],
        'clickbank': ['client_id', 'developer_key', 'nickname'],
        'shareasale': ['affiliate_id', 'token', 'secret_key'],
        'rakuten': ['token', 'merchant_ids'],
        'impact': ['account_sid', 'auth_token'],
        'partnerize': ['api_key', 'user_api_key'],
        'avantlink': ['affiliate_id', 'website_id'],
        'awin': ['publisher_id', 'api_token']
    }
    
    return field_mappings.get(network_id, [])

def _get_compliance_requirements(compliance_terms: Dict[str, Any]) -> List[str]:
    """Generate human-readable compliance requirements"""
    
    requirements = []
    
    if compliance_terms.get('attribution_required'):
        requirements.append("All links must include proper affiliate tracking")
    
    if compliance_terms.get('data_retention') == '24_hours':
        requirements.append("Price data must be refreshed within 24 hours")
    elif compliance_terms.get('data_retention') == '30_days':
        requirements.append("Data can be cached for up to 30 days")
    
    if 'no_email_marketing' in compliance_terms.get('content_restrictions', []):
        requirements.append("Cannot be used in email marketing campaigns")
    
    if 'social_media_approval_needed' in compliance_terms.get('content_restrictions', []):
        requirements.append("Social media usage requires prior approval")
    
    if 'no_trademark_bidding' in compliance_terms.get('content_restrictions', []):
        requirements.append("Cannot bid on trademark terms in advertising")
    
    return requirements

def _get_compliance_best_practices(network_id: str) -> List[str]:
    """Get best practices for each network"""
    
    practices = {
        'amazon': [
            "Always display current prices",
            "Include disclaimer about price changes",
            "Respect 24-hour data freshness requirement",
            "Use proper associate tag in all links"
        ],
        'shareasale': [
            "Monitor trademark restrictions",
            "Use deep linking appropriately",
            "Respect advertiser-specific terms"
        ],
        'rakuten': [
            "Check merchant-specific requirements",
            "Use approved promotional materials",
            "Monitor commission structure changes"
        ]
    }
    
    return practices.get(network_id, [
        "Follow network-specific terms of service",
        "Monitor compliance regularly",
        "Keep affiliate disclosures visible"
    ])