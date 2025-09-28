"""
Automated Deal Fetching Service
Fetches deals from various affiliate networks and processes them with AI validation
"""

import asyncio
import aiohttp
import json
import logging
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import xml.etree.ElementTree as ET
from urllib.parse import urlencode, urlparse, parse_qs
import hashlib
import hmac
import base64
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Deal, DealCreate
from services.ai_service import AIService
from services.affiliate_networks import AffiliateNetworkManager
import uuid

logger = logging.getLogger(__name__)

class DealFetcher:
    def __init__(self):
        self.ai_service = AIService()
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def fetch_amazon_deals(self, keywords: List[str] = None) -> List[Dict]:
        """
        Fetch deals from Amazon Product Advertising API
        Requires AWS access keys and associate tag
        """
        deals = []
        
        # Amazon PA-API 5.0 configuration
        access_key = os.getenv('AWS_ACCESS_KEY_ID')
        secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
        associate_tag = os.getenv('AMAZON_ASSOCIATE_TAG')
        
        if not all([access_key, secret_key, associate_tag]):
            logger.warning("Amazon API credentials not configured")
            return []
            
        # Default search keywords if none provided
        if not keywords:
            keywords = ['electronics', 'deals', 'discount', 'sale', 'clearance']
            
        for keyword in keywords:
            try:
                # Amazon PA-API search parameters
                params = {
                    'Service': 'AWSECommerceService',
                    'Operation': 'ItemSearch',
                    'SearchIndex': 'All',
                    'Keywords': keyword,
                    'ResponseGroup': 'Images,ItemAttributes,Offers',
                    'AssociateTag': associate_tag,
                    'AWSAccessKeyId': access_key,
                    'Timestamp': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
                }
                
                # Generate AWS signature
                signature = self._generate_amazon_signature(params, secret_key)
                params['Signature'] = signature
                
                url = f"https://webservices.amazon.com/onca/xml?{urlencode(params)}"
                
                async with self.session.get(url) as response:
                    if response.status == 200:
                        xml_data = await response.text()
                        parsed_deals = self._parse_amazon_response(xml_data)
                        deals.extend(parsed_deals)
                        
                # Rate limiting - Amazon allows 1 request per second
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Error fetching Amazon deals for keyword '{keyword}': {e}")
                
        return deals

    async def fetch_cj_deals(self, advertiser_ids: List[str] = None) -> List[Dict]:
        """
        Fetch deals from Commission Junction (CJ Affiliate)
        Requires CJ Developer Key
        """
        deals = []
        cj_api_key = os.getenv('CJ_DEVELOPER_KEY')
        
        if not cj_api_key:
            logger.warning("CJ API key not configured")
            return []
            
        # CJ Link Search API
        base_url = "https://link-search.api.cj.com/v2/link-search"
        
        # Default advertiser IDs for major retailers
        if not advertiser_ids:
            advertiser_ids = ['2617611', '13117106', '3870499']  # Example IDs
            
        try:
            headers = {
                'Authorization': f'Bearer {cj_api_key}',
                'Accept': 'application/json'
            }
            
            params = {
                'website-id': os.getenv('CJ_WEBSITE_ID', 'your-website-id'),
                'advertiser-ids': ','.join(advertiser_ids),
                'keywords': 'deal discount sale clearance',
                'records-per-page': 50,
                'promotion-type': 'coupon,deal'
            }
            
            async with self.session.get(base_url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    deals = self._parse_cj_response(data)
                else:
                    logger.error(f"CJ API error: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error fetching CJ deals: {e}")
            
        return deals

    async def fetch_clickbank_deals(self) -> List[Dict]:
        """
        Fetch deals from ClickBank
        Uses ClickBank marketplace feed
        """
        deals = []
        cb_client_id = os.getenv('CLICKBANK_CLIENT_ID')
        cb_developer_key = os.getenv('CLICKBANK_DEVELOPER_KEY')
        
        if not all([cb_client_id, cb_developer_key]):
            logger.warning("ClickBank API credentials not configured")
            return []
            
        try:
            # ClickBank marketplace API
            base_url = "https://api.clickbank.com/rest/1.3/marketplace/products"
            
            headers = {
                'Accept': 'application/json',
                'Authorization': f'Bearer {cb_developer_key}'
            }
            
            params = {
                'sort': 'popularity',
                'category': 'all',
                'results-per-page': 50,
                'language': 'EN'
            }
            
            async with self.session.get(base_url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    deals = self._parse_clickbank_response(data)
                else:
                    logger.error(f"ClickBank API error: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error fetching ClickBank deals: {e}")
            
        return deals

    async def fetch_all_deals(self) -> List[Dict]:
        """
        Fetch deals from all configured affiliate networks using the new comprehensive system
        """
        all_deals = []
        
        # Use the comprehensive affiliate network manager
        async with AffiliateNetworkManager() as network_manager:
            all_deals = await network_manager.fetch_all_network_deals()
                
        return all_deals

    async def process_and_validate_deals(self, raw_deals: List[Dict]) -> List[DealCreate]:
        """
        Process raw deals through AI validation and create DealCreate objects
        """
        validated_deals = []
        
        for raw_deal in raw_deals:
            try:
                # AI validation and enhancement
                ai_result = await self.ai_service.validate_and_enhance_deal(raw_deal)
                
                if ai_result['is_valid'] and ai_result['quality_score'] >= 6.0:
                    # Create DealCreate object
                    deal_data = DealCreate(
                        title=ai_result.get('enhanced_title', raw_deal['title']),
                        description=ai_result.get('enhanced_description', raw_deal['description']),
                        original_price=raw_deal['original_price'],
                        sale_price=raw_deal['sale_price'],
                        discount_percentage=raw_deal.get('discount_percentage', 0),
                        store=raw_deal['store'],
                        category=ai_result.get('category', 'General'),
                        affiliate_url=raw_deal['affiliate_url'],
                        image_url=raw_deal.get('image_url', ''),
                        deal_type=ai_result.get('deal_type', 'regular'),
                        ai_score=ai_result['quality_score'],
                        ai_approved=ai_result['quality_score'] >= 8.5,
                        ai_validation_data=json.dumps(ai_result)
                    )
                    
                    validated_deals.append(deal_data)
                    
            except Exception as e:
                logger.error(f"Error processing deal: {e}")
                
        return validated_deals

    async def save_deals_to_database(self, deals: List[DealCreate]) -> int:
        """
        Save validated deals to the database
        """
        saved_count = 0
        
        async with get_db() as db:
            for deal_data in deals:
                try:
                    # Check for duplicates based on affiliate URL
                    existing = await db.execute(
                        select(Deal).where(Deal.affiliate_url == deal_data.affiliate_url)
                    )
                    
                    if existing.scalar_one_or_none():
                        continue  # Skip duplicate
                        
                    # Create new deal
                    deal = Deal(
                        id=str(uuid.uuid4()),
                        **deal_data.model_dump()
                    )
                    
                    db.add(deal)
                    saved_count += 1
                    
                except Exception as e:
                    logger.error(f"Error saving deal to database: {e}")
                    
            await db.commit()
            
        return saved_count

    def _generate_amazon_signature(self, params: Dict, secret_key: str) -> str:
        """Generate AWS signature for Amazon PA-API"""
        query_string = urlencode(sorted(params.items()))
        string_to_sign = f"GET\nwebservices.amazon.com\n/onca/xml\n{query_string}"
        
        signature = hmac.new(
            secret_key.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha256
        ).digest()
        
        return base64.b64encode(signature).decode('utf-8')

    def _parse_amazon_response(self, xml_data: str) -> List[Dict]:
        """Parse Amazon XML response into deal objects"""
        deals = []
        
        try:
            root = ET.fromstring(xml_data)
            items = root.findall('.//Item')
            
            for item in items:
                try:
                    # Extract deal information
                    title = item.find('.//Title')
                    title = title.text if title is not None else "Unknown Product"
                    
                    # Price information
                    list_price = item.find('.//ListPrice/FormattedPrice')
                    offer_price = item.find('.//Price/FormattedPrice')
                    
                    if list_price is not None and offer_price is not None:
                        original_price = self._extract_price(list_price.text)
                        sale_price = self._extract_price(offer_price.text)
                        
                        if original_price and sale_price and sale_price < original_price:
                            discount_pct = ((original_price - sale_price) / original_price) * 100
                            
                            deal = {
                                'title': title,
                                'description': f"Amazon deal: {title}",
                                'original_price': original_price,
                                'sale_price': sale_price,
                                'discount_percentage': round(discount_pct, 2),
                                'store': 'Amazon',
                                'affiliate_url': item.find('.//DetailPageURL').text,
                                'image_url': item.find('.//LargeImage/URL').text if item.find('.//LargeImage/URL') is not None else '',
                                'source': 'amazon'
                            }
                            
                            deals.append(deal)
                            
                except Exception as e:
                    logger.error(f"Error parsing Amazon item: {e}")
                    
        except Exception as e:
            logger.error(f"Error parsing Amazon XML: {e}")
            
        return deals

    def _parse_cj_response(self, data: Dict) -> List[Dict]:
        """Parse CJ JSON response into deal objects"""
        deals = []
        
        try:
            if 'links' in data:
                for link in data['links']:
                    try:
                        deal = {
                            'title': link.get('link-name', 'CJ Deal'),
                            'description': link.get('description', ''),
                            'original_price': 0,  # CJ doesn't always provide pricing
                            'sale_price': 0,
                            'discount_percentage': 0,
                            'store': link.get('advertiser-name', 'Unknown Store'),
                            'affiliate_url': link.get('link-code-html', ''),
                            'image_url': '',
                            'source': 'cj'
                        }
                        
                        deals.append(deal)
                        
                    except Exception as e:
                        logger.error(f"Error parsing CJ link: {e}")
                        
        except Exception as e:
            logger.error(f"Error parsing CJ response: {e}")
            
        return deals

    def _parse_clickbank_response(self, data: Dict) -> List[Dict]:
        """Parse ClickBank JSON response into deal objects"""
        deals = []
        
        try:
            if 'products' in data:
                for product in data['products']:
                    try:
                        # ClickBank pricing
                        price = product.get('price', 0)
                        commission_rate = product.get('commission-rate', 0)
                        
                        deal = {
                            'title': product.get('title', 'ClickBank Product'),
                            'description': product.get('description', ''),
                            'original_price': price,
                            'sale_price': price,  # ClickBank doesn't have traditional discounts
                            'discount_percentage': 0,
                            'store': 'ClickBank',
                            'affiliate_url': f"https://hop.clickbank.net/?affiliate={os.getenv('CLICKBANK_NICKNAME', 'your-nickname')}&vendor={product.get('vendor')}",
                            'image_url': '',
                            'source': 'clickbank'
                        }
                        
                        deals.append(deal)
                        
                    except Exception as e:
                        logger.error(f"Error parsing ClickBank product: {e}")
                        
        except Exception as e:
            logger.error(f"Error parsing ClickBank response: {e}")
            
        return deals

    def _extract_price(self, price_str: str) -> float:
        """Extract numeric price from formatted string"""
        try:
            # Remove currency symbols and extract number
            import re
            price_match = re.search(r'[\d,]+\.?\d*', price_str.replace(',', ''))
            if price_match:
                return float(price_match.group())
        except:
            pass
        return 0.0


# Background task runner
async def run_deal_fetching_cycle():
    """
    Run a complete cycle of deal fetching, validation, and database storage
    """
    logger.info("Starting automated deal fetching cycle")
    
    try:
        async with DealFetcher() as fetcher:
            # Fetch raw deals from all sources
            raw_deals = await fetcher.fetch_all_deals()
            logger.info(f"Fetched {len(raw_deals)} raw deals")
            
            # Validate and enhance with AI
            validated_deals = await fetcher.process_and_validate_deals(raw_deals)
            logger.info(f"Validated {len(validated_deals)} deals")
            
            # Save to database
            saved_count = await fetcher.save_deals_to_database(validated_deals)
            logger.info(f"Saved {saved_count} new deals to database")
            
            return {
                'raw_deals_count': len(raw_deals),
                'validated_deals_count': len(validated_deals),
                'saved_deals_count': saved_count,
                'timestamp': datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        logger.error(f"Error in deal fetching cycle: {e}")
        raise


if __name__ == "__main__":
    # Test the deal fetcher
    asyncio.run(run_deal_fetching_cycle())