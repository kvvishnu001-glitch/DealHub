"""
Deal Validation Utilities
Ensures all deals meet mandatory field requirements and compliance standards
"""

import re
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

class DealValidator:
    """Validates deals for mandatory fields and compliance requirements"""
    
    def __init__(self):
        self.required_fields = [
            'title', 'description', 'original_price', 'sale_price', 
            'store', 'category', 'affiliate_url'
        ]
        
        # Image dimensions for different display contexts
        self.image_sizes = {
            'card': {'width': 300, 'height': 200},
            'thumbnail': {'width': 150, 'height': 100},
            'banner': {'width': 600, 'height': 300}
        }
    
    def validate_deal_completeness(self, deal: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive validation of deal mandatory fields"""
        
        validation_result = {
            'is_valid': True,
            'missing_fields': [],
            'field_errors': [],
            'warnings': []
        }
        
        # Check required fields are present and not empty
        for field in self.required_fields:
            value = deal.get(field)
            if not value or (isinstance(value, str) and not value.strip()):
                validation_result['missing_fields'].append(field)
                validation_result['is_valid'] = False
        
        # Validate title length and content
        title = deal.get('title', '')
        if title:
            if len(title.strip()) < 10:
                validation_result['field_errors'].append('Title too short (minimum 10 characters)')
                validation_result['is_valid'] = False
            elif len(title.strip()) > 200:
                validation_result['field_errors'].append('Title too long (maximum 200 characters)')
                validation_result['is_valid'] = False
        
        # Validate description
        description = deal.get('description', '')
        if description:
            if len(description.strip()) < 20:
                validation_result['field_errors'].append('Description too short (minimum 20 characters)')
                validation_result['is_valid'] = False
        
        # Validate prices
        price_validation = self._validate_prices(deal)
        if not price_validation['valid']:
            validation_result['field_errors'].extend(price_validation['errors'])
            validation_result['is_valid'] = False
        
        # Validate affiliate URL
        url_validation = self._validate_affiliate_url(deal.get('affiliate_url', ''))
        if not url_validation['valid']:
            validation_result['field_errors'].extend(url_validation['errors'])
            validation_result['is_valid'] = False
        
        # Validate image URL (must be external)
        image_validation = self._validate_image_url(deal.get('image_url', ''))
        if not image_validation['valid']:
            validation_result['warnings'].extend(image_validation['warnings'])
        
        # Validate store and category
        store = deal.get('store', '').strip()
        category = deal.get('category', '').strip()
        
        if store and len(store) < 2:
            validation_result['field_errors'].append('Store name too short')
            validation_result['is_valid'] = False
        
        if category and len(category) < 3:
            validation_result['field_errors'].append('Category name too short')
            validation_result['is_valid'] = False
        
        return validation_result
    
    def _validate_prices(self, deal: Dict[str, Any]) -> Dict[str, Any]:
        """Validate price fields"""
        result = {'valid': True, 'errors': []}
        
        try:
            original_price = float(deal.get('original_price', 0))
            sale_price = float(deal.get('sale_price', 0))
            
            if original_price <= 0:
                result['errors'].append('Original price must be greater than 0')
                result['valid'] = False
            
            if sale_price <= 0:
                result['errors'].append('Sale price must be greater than 0')
                result['valid'] = False
            
            if original_price > 0 and sale_price > 0 and sale_price >= original_price:
                result['errors'].append('Sale price must be less than original price')
                result['valid'] = False
            
            # Check for reasonable price ranges
            if original_price > 100000:  # $100k max
                result['errors'].append('Original price seems unreasonably high')
                result['valid'] = False
            
            if sale_price < 0.01:  # 1 cent minimum
                result['errors'].append('Sale price too low')
                result['valid'] = False
                
        except (ValueError, TypeError):
            result['errors'].append('Invalid price format - must be numeric')
            result['valid'] = False
        
        return result
    
    def _validate_affiliate_url(self, url: str) -> Dict[str, Any]:
        """Validate affiliate URL format and compliance"""
        result = {'valid': True, 'errors': []}
        
        if not url:
            result['errors'].append('Affiliate URL is required')
            result['valid'] = False
            return result
        
        try:
            parsed = urlparse(url)
            
            # Must be a valid HTTP/HTTPS URL
            if not parsed.scheme in ['http', 'https']:
                result['errors'].append('Affiliate URL must use HTTP or HTTPS')
                result['valid'] = False
            
            if not parsed.netloc:
                result['errors'].append('Invalid affiliate URL format')
                result['valid'] = False
            
            # Check for common affiliate tracking parameters or known affiliate domains
            tracking_indicators = [
                'tag=', 'affiliate', 'ref=', 'partner', 'click', 'track',
                'hop.clickbank', 'tkqlhce', 'avantlink', 'shareasale'
            ]
            
            # Known affiliate domains that are inherently tracked
            affiliate_domains = [
                'a.co',  # Amazon shortened links
                'amzn.to',  # Amazon shortened links  
                'amazon.com',
                'clickbank.com',
                'shareasale.com',
                'cj.com',
                'commission-junction.com',
                'rakuten.com',
                'impact.com',
                'partnerize.com',
                'avantlink.com',
                'awin.com',
                'linksynergy.com'
            ]
            
            has_tracking = any(indicator in url.lower() for indicator in tracking_indicators)
            is_affiliate_domain = any(domain in parsed.netloc.lower() for domain in affiliate_domains)
            
            if not has_tracking and not is_affiliate_domain:
                result['errors'].append('Affiliate URL missing tracking parameters or not from recognized affiliate network')
                result['valid'] = False
                
        except Exception:
            result['errors'].append('Invalid URL format')
            result['valid'] = False
        
        return result
    
    def _validate_image_url(self, image_url: str) -> Dict[str, Any]:
        """Validate image URL - must be external, not stored locally"""
        result = {'valid': True, 'warnings': []}
        
        if not image_url:
            result['warnings'].append('No image URL provided')
            return result
        
        try:
            parsed = urlparse(image_url)
            
            # Must be external URL (compliance with operating agreements)
            if not parsed.scheme in ['http', 'https']:
                result['warnings'].append('Image URL should use HTTP or HTTPS')
                result['valid'] = False
            
            # Check it's not a local/relative path
            if image_url.startswith('/') or not parsed.netloc:
                result['warnings'].append('Images must be hosted externally (compliance requirement)')
                result['valid'] = False
            
            # Check for common image file extensions
            valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
            if not any(image_url.lower().endswith(ext) for ext in valid_extensions):
                result['warnings'].append('Image URL should point to a valid image file')
            
        except Exception:
            result['warnings'].append('Invalid image URL format')
            result['valid'] = False
        
        return result
    
    def generate_responsive_image_url(self, original_url: str, size_type: str = 'card') -> str:
        """Generate responsive image URL with proper sizing"""
        
        if not original_url or size_type not in self.image_sizes:
            return original_url
        
        dimensions = self.image_sizes[size_type]
        
        # For external images, we'll use URL parameters for resizing services
        # This ensures we don't store images locally (compliance requirement)
        
        # Check if it's already a resized URL
        if any(param in original_url for param in ['w=', 'width=', 'h=', 'height=', 'resize']):
            return original_url
        
        # Add sizing parameters based on common CDN patterns
        if 'amazon' in original_url.lower():
            # Amazon images support sizing parameters
            separator = '&' if '?' in original_url else '?'
            return f"{original_url}{separator}w={dimensions['width']}&h={dimensions['height']}"
        
        elif 'shopify' in original_url.lower():
            # Shopify CDN sizing
            if '_master.' in original_url:
                return original_url.replace('_master.', f"_{dimensions['width']}x{dimensions['height']}.")
        
        elif 'cloudinary' in original_url.lower():
            # Cloudinary transformation
            if '/image/upload/' in original_url:
                return original_url.replace('/image/upload/', f"/image/upload/w_{dimensions['width']},h_{dimensions['height']},c_fill/")
        
        # For other CDNs, try generic URL parameters
        separator = '&' if '?' in original_url else '?'
        return f"{original_url}{separator}w={dimensions['width']}&h={dimensions['height']}&fit=crop"
    
    def sanitize_deal_data(self, deal: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize and clean deal data"""
        
        sanitized = deal.copy()
        
        # Clean and trim text fields
        text_fields = ['title', 'description', 'store', 'category']
        for field in text_fields:
            if sanitized.get(field):
                sanitized[field] = sanitized[field].strip()
        
        # Ensure image URL is external and properly sized
        if sanitized.get('image_url'):
            sanitized['image_url'] = self.generate_responsive_image_url(
                sanitized['image_url'], 'card'
            )
        
        # Format prices consistently
        try:
            if sanitized.get('original_price'):
                sanitized['original_price'] = round(float(sanitized['original_price']), 2)
            if sanitized.get('sale_price'):
                sanitized['sale_price'] = round(float(sanitized['sale_price']), 2)
            
            # Calculate discount percentage if not provided
            if not sanitized.get('discount_percentage') and sanitized.get('original_price') and sanitized.get('sale_price'):
                original = float(sanitized['original_price'])
                sale = float(sanitized['sale_price'])
                if original > sale > 0:
                    discount = ((original - sale) / original) * 100
                    sanitized['discount_percentage'] = round(discount, 1)
        except (ValueError, TypeError):
            pass
        
        return sanitized
    
    def get_validation_summary(self, deals: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get validation summary for a list of deals"""
        
        total_deals = len(deals)
        valid_deals = 0
        validation_issues = {
            'missing_fields': {},
            'field_errors': {},
            'warnings': {}
        }
        
        for deal in deals:
            validation = self.validate_deal_completeness(deal)
            
            if validation['is_valid']:
                valid_deals += 1
            
            # Count missing fields
            for field in validation['missing_fields']:
                validation_issues['missing_fields'][field] = validation_issues['missing_fields'].get(field, 0) + 1
            
            # Count field errors
            for error in validation['field_errors']:
                validation_issues['field_errors'][error] = validation_issues['field_errors'].get(error, 0) + 1
            
            # Count warnings
            for warning in validation['warnings']:
                validation_issues['warnings'][warning] = validation_issues['warnings'].get(warning, 0) + 1
        
        return {
            'total_deals': total_deals,
            'valid_deals': valid_deals,
            'invalid_deals': total_deals - valid_deals,
            'validation_rate': (valid_deals / total_deals * 100) if total_deals > 0 else 0,
            'issues': validation_issues
        }