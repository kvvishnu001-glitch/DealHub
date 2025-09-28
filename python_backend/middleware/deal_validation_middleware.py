"""
Deal Validation Middleware
Ensures all deals returned by API meet mandatory field requirements
"""

from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import json
import logging

logger = logging.getLogger(__name__)

class DealValidationMiddleware(BaseHTTPMiddleware):
    """Middleware to validate deal responses before sending to clients"""
    
    def __init__(self, app):
        super().__init__(app)
        self.deal_endpoints = ['/api/deals', '/api/admin/deals']
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Only validate deal-related endpoints
        if any(endpoint in str(request.url) for endpoint in self.deal_endpoints):
            # Only validate successful responses
            if response.status_code == 200:
                try:
                    # Get response body
                    body = b""
                    async for chunk in response.body_iterator:
                        body += chunk
                    
                    if body:
                        data = json.loads(body.decode())
                        
                        # Validate deals if response contains deals array
                        if isinstance(data, list):
                            validated_deals = self._validate_deals_array(data)
                            if len(validated_deals) != len(data):
                                logger.warning(f"Filtered {len(data) - len(validated_deals)} invalid deals from response")
                            
                            return JSONResponse(
                                content=validated_deals,
                                status_code=response.status_code,
                                headers=dict(response.headers)
                            )
                        
                        elif isinstance(data, dict) and 'id' in data:
                            # Single deal response
                            if self._validate_single_deal(data):
                                return JSONResponse(
                                    content=data,
                                    status_code=response.status_code,
                                    headers=dict(response.headers)
                                )
                            else:
                                logger.warning(f"Deal {data.get('id')} failed validation")
                                return JSONResponse(
                                    content={"error": "Deal data incomplete"},
                                    status_code=422
                                )
                    
                    # Return original response if no modifications needed
                    return Response(
                        content=body,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        media_type=response.media_type
                    )
                    
                except Exception as e:
                    logger.error(f"Error validating deal response: {e}")
                    # Return original response on validation error
                    pass
        
        return response
    
    def _validate_deals_array(self, deals):
        """Validate array of deals"""
        validated_deals = []
        
        for deal in deals:
            if self._validate_single_deal(deal):
                validated_deals.append(deal)
        
        return validated_deals
    
    def _validate_single_deal(self, deal):
        """Validate a single deal has all mandatory fields"""
        required_fields = [
            'title', 'description', 'originalPrice', 'salePrice', 
            'store', 'category', 'affiliateUrl'
        ]
        
        # Check all required fields exist and are not empty
        for field in required_fields:
            value = deal.get(field)
            if not value or (isinstance(value, str) and not value.strip()):
                logger.debug(f"Deal {deal.get('id')} missing required field: {field}")
                return False
        
        # Validate prices
        try:
            original_price = float(deal.get('originalPrice', 0))
            sale_price = float(deal.get('salePrice', 0))
            
            if original_price <= 0 or sale_price <= 0:
                logger.debug(f"Deal {deal.get('id')} has invalid price values")
                return False
            
            if sale_price >= original_price:
                logger.debug(f"Deal {deal.get('id')} sale price not less than original price")
                return False
            
        except (ValueError, TypeError):
            logger.debug(f"Deal {deal.get('id')} has non-numeric price values")
            return False
        
        # Validate affiliate URL
        affiliate_url = deal.get('affiliateUrl', '')
        if not affiliate_url.startswith(('http://', 'https://')):
            logger.debug(f"Deal {deal.get('id')} has invalid affiliate URL")
            return False
        
        # Validate image URL if present (must be external)
        image_url = deal.get('imageUrl', '')
        if image_url and not image_url.startswith(('http://', 'https://')):
            logger.debug(f"Deal {deal.get('id')} has invalid image URL (must be external)")
            # Don't fail validation for missing/invalid images, just log warning
            logger.warning(f"Deal {deal.get('id')} image URL not external - compliance issue")
        
        # Check title and description length
        title = deal.get('title', '')
        description = deal.get('description', '')
        
        if len(title.strip()) < 10 or len(title.strip()) > 200:
            logger.debug(f"Deal {deal.get('id')} title length invalid")
            return False
        
        if len(description.strip()) < 20:
            logger.debug(f"Deal {deal.get('id')} description too short")
            return False
        
        return True