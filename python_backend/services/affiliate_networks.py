"""
Comprehensive Affiliate Network Management System
Supports all major US affiliate networks with compliance handling
"""

import asyncio
import aiohttp
import json
import logging
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Union
import xml.etree.ElementTree as ET
from urllib.parse import urlencode, urlparse, parse_qs
import hashlib
import hmac
import base64
import ftplib
import csv
import io
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update

from database import get_db
from models import Deal, DealCreate, AffiliateNetwork, AffiliateConfig
from services.ai_service import AIService
import uuid

logger = logging.getLogger(__name__)

class AffiliateNetworkManager:
    """Manages all affiliate network integrations with compliance"""
    
    def __init__(self):
        self.ai_service = AIService()
        self.session = None
        
        # Network configurations with compliance terms
        self.networks = {
            'amazon': {
                'name': 'Amazon Associates',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '24_hours',
                    'price_freshness': 'real_time_required',
                    'attribution_required': True,
                    'link_format': 'tracking_required',
                    'content_restrictions': ['no_email_marketing', 'social_media_approval_needed']
                }
            },
            'cj': {
                'name': 'Commission Junction',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '30_days',
                    'attribution_required': True,
                    'link_format': 'tracking_required',
                    'content_restrictions': ['advertiser_specific_terms']
                }
            },
            'clickbank': {
                'name': 'ClickBank',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': 'unlimited',
                    'attribution_required': True,
                    'link_format': 'hoplink_required'
                }
            },
            'shareasale': {
                'name': 'ShareASale',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '30_days',
                    'attribution_required': True,
                    'link_format': 'tracking_required',
                    'content_restrictions': ['no_trademark_bidding']
                }
            },
            'rakuten': {
                'name': 'Rakuten Advertising',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '30_days',
                    'attribution_required': True,
                    'link_format': 'tracking_required'
                }
            },
            'impact': {
                'name': 'Impact (formerly Impact Radius)',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '30_days',
                    'attribution_required': True,
                    'link_format': 'tracking_required'
                }
            },
            'partnerize': {
                'name': 'Partnerize (formerly Performance Horizon)',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '30_days',
                    'attribution_required': True,
                    'link_format': 'tracking_required'
                }
            },
            'avantlink': {
                'name': 'AvantLink',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '30_days',
                    'attribution_required': True,
                    'link_format': 'tracking_required'
                }
            },
            'pepperjam': {
                'name': 'Pepperjam (eBay Enterprise)',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '30_days',
                    'attribution_required': True,
                    'link_format': 'tracking_required'
                }
            },
            'linkshare': {
                'name': 'LinkShare (Rakuten)',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '30_days',
                    'attribution_required': True,
                    'link_format': 'tracking_required'
                }
            },
            'affiliatewindow': {
                'name': 'Affiliate Window (AWIN)',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '30_days',
                    'attribution_required': True,
                    'link_format': 'tracking_required'
                }
            },
            'tradedoubler': {
                'name': 'TradeDoubler',
                'type': 'api',
                'compliance_terms': {
                    'data_retention': '30_days',
                    'attribution_required': True,
                    'link_format': 'tracking_required'
                }
            }
        }
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def get_network_config(self, network_id: str, db: AsyncSession) -> Optional[Dict]:
        """Get network configuration from database"""
        result = await db.execute(
            select(AffiliateConfig).where(AffiliateConfig.network_id == network_id)
        )
        config = result.scalar_one_or_none()
        return config.config_data if config else None

    async def save_network_config(self, network_id: str, config_data: Dict, db: AsyncSession):
        """Save network configuration to database"""
        # Check if config exists
        result = await db.execute(
            select(AffiliateConfig).where(AffiliateConfig.network_id == network_id)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            await db.execute(
                update(AffiliateConfig)
                .where(AffiliateConfig.network_id == network_id)
                .values(
                    config_data=config_data,
                    updated_at=datetime.utcnow(),
                    is_active=True
                )
            )
        else:
            new_config = AffiliateConfig(
                network_id=network_id,
                network_name=self.networks[network_id]['name'],
                config_data=config_data,
                compliance_terms=self.networks[network_id]['compliance_terms'],
                is_active=True
            )
            db.add(new_config)
        
        await db.commit()

    async def fetch_amazon_deals(self, config: Dict) -> List[Dict]:
        """Amazon Associates Product Advertising API"""
        deals = []
        
        try:
            access_key = config.get('aws_access_key_id')
            secret_key = config.get('aws_secret_access_key')
            associate_tag = config.get('associate_tag')
            
            # Validate credentials are not dummy/test values
            if not all([access_key, secret_key, associate_tag]):
                raise ValueError("Missing required Amazon credentials")
            
            # Check for dummy/test credentials
            dummy_patterns = ['test', 'dummy', 'fake', 'example', 'placeholder', 'xxx', '123']
            for field_name, field_value in [('access_key', access_key), ('secret_key', secret_key), ('associate_tag', associate_tag)]:
                if any(pattern in str(field_value).lower() for pattern in dummy_patterns):
                    raise ValueError(f"Invalid {field_name}: appears to be test/dummy data")
            
            if len(access_key) < 10 or len(secret_key) < 20:
                raise ValueError("Amazon credentials appear to be invalid (too short)")
                
            keywords = config.get('keywords', ['deal', 'discount', 'sale'])
            
            for keyword in keywords:
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
                
                signature = self._generate_amazon_signature(params, secret_key)
                params['Signature'] = signature
                
                url = f"https://webservices.amazon.com/onca/xml?{urlencode(params)}"
                
                async with self.session.get(url) as response:
                    if response.status == 200:
                        xml_data = await response.text()
                        parsed_deals = self._parse_amazon_response(xml_data, associate_tag)
                        deals.extend(parsed_deals)
                        
                await asyncio.sleep(1)  # Rate limiting
                
        except Exception as e:
            print(f"Error fetching Amazon deals: {e}")
            # Always re-raise exceptions so they can be caught by the test endpoint
            raise ValueError(f"Amazon API error: {str(e)}")
            
        return deals

    async def fetch_cj_deals(self, config: Dict) -> List[Dict]:
        """Commission Junction API integration"""
        deals = []
        
        try:
            developer_key = config.get('developer_key')
            website_id = config.get('website_id')
            
            if not all([developer_key, website_id]):
                return []
                
            headers = {
                'Authorization': f'Bearer {developer_key}',
                'Accept': 'application/json'
            }
            
            # CJ Product Catalog API
            url = "https://product-search.api.cj.com/v2/product-search"
            params = {
                'website-id': website_id,
                'keywords': 'sale discount deal',
                'advertiser-ids': config.get('advertiser_ids', ''),
                'records-per-page': 50,
                'sort-by': 'sale-price'
            }
            
            async with self.session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    deals = self._parse_cj_response(data, website_id)
                    
        except Exception as e:
            logger.error(f"Error fetching CJ deals: {e}")
            
        return deals

    async def fetch_clickbank_deals(self, config: Dict) -> List[Dict]:
        """ClickBank Marketplace API integration"""
        deals = []
        
        try:
            client_id = config.get('client_id')
            developer_key = config.get('developer_key')
            nickname = config.get('nickname')
            
            if not all([client_id, developer_key, nickname]):
                return []
                
            headers = {
                'Authorization': f'Bearer {developer_key}',
                'Accept': 'application/json'
            }
            
            # ClickBank Product Catalog API
            url = "https://api.clickbank.com/rest/1.3/marketplace/search"
            params = {
                'searchTerm': 'deal',
                'sortBy': 'gravity',
                'count': 50
            }
            
            async with self.session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    deals = self._parse_clickbank_response(data, nickname)
                    
        except Exception as e:
            logger.error(f"Error fetching ClickBank deals: {e}")
            
        return deals

    async def fetch_shareasale_deals(self, config: Dict) -> List[Dict]:
        """ShareASale API integration"""
        deals = []
        
        try:
            affiliate_id = config.get('affiliate_id')
            token = config.get('token')
            secret_key = config.get('secret_key')
            
            if not all([affiliate_id, token, secret_key]):
                return []
                
            # ShareASale API call
            timestamp = str(int(datetime.utcnow().timestamp()))
            sig_string = f"{token}:{timestamp}:{secret_key}"
            signature = hashlib.sha256(sig_string.encode()).hexdigest()
            
            headers = {
                'x-ShareASale-Date': timestamp,
                'x-ShareASale-Authentication': signature
            }
            
            # Get deals/coupons
            url = f"https://api.shareasale.com/w.cfm?action=deals&affiliateId={affiliate_id}&token={token}"
            
            async with self.session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.text()
                    deals = self._parse_shareasale_response(data, affiliate_id)
                    
        except Exception as e:
            logger.error(f"Error fetching ShareASale deals: {e}")
            
        return deals

    async def fetch_rakuten_deals(self, config: Dict) -> List[Dict]:
        """Rakuten Advertising (formerly LinkShare) API"""
        deals = []
        
        try:
            token = config.get('token')
            
            if not token:
                return []
                
            headers = {
                'Authorization': f'Bearer {token}',
                'Accept': 'application/json'
            }
            
            # Rakuten Link Locator API
            url = "https://api.linksynergy.com/coupon/1.0"
            params = {
                'mid': config.get('merchant_ids', ''),
                'cat': 'coupons',
                'resultsperpage': 50
            }
            
            async with self.session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    deals = self._parse_rakuten_response(data)
                    
        except Exception as e:
            logger.error(f"Error fetching Rakuten deals: {e}")
            
        return deals

    async def fetch_impact_deals(self, config: Dict) -> List[Dict]:
        """Impact (formerly Impact Radius) API"""
        deals = []
        
        try:
            account_sid = config.get('account_sid')
            auth_token = config.get('auth_token')
            
            if not all([account_sid, auth_token]):
                return []
                
            auth = base64.b64encode(f"{account_sid}:{auth_token}".encode()).decode()
            headers = {
                'Authorization': f'Basic {auth}',
                'Accept': 'application/json'
            }
            
            # Impact API for deals
            url = f"https://api.impact.com/{account_sid}/Promotions"
            params = {
                'PageSize': 100,
                'PromotionType': 'DEAL'
            }
            
            async with self.session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    deals = self._parse_impact_response(data)
                    
        except Exception as e:
            logger.error(f"Error fetching Impact deals: {e}")
            
        return deals

    async def fetch_partnerize_deals(self, config: Dict) -> List[Dict]:
        """Partnerize (formerly Performance Horizon) API"""
        deals = []
        
        try:
            api_key = config.get('api_key')
            user_api_key = config.get('user_api_key')
            
            if not all([api_key, user_api_key]):
                return []
                
            headers = {
                'User-Api-Key': user_api_key,
                'Api-Key': api_key,
                'Accept': 'application/json'
            }
            
            # Partnerize Creative API
            url = "https://api.partnerize.com/creative"
            params = {
                'creative_type': 'promotion',
                'limit': 100
            }
            
            async with self.session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    deals = self._parse_partnerize_response(data)
                    
        except Exception as e:
            logger.error(f"Error fetching Partnerize deals: {e}")
            
        return deals

    async def fetch_avantlink_deals(self, config: Dict) -> List[Dict]:
        """AvantLink API integration"""
        deals = []
        
        try:
            affiliate_id = config.get('affiliate_id')
            website_id = config.get('website_id')
            
            if not all([affiliate_id, website_id]):
                return []
                
            # AvantLink doesn't require authentication for public feeds
            url = f"https://www.avantlink.com/api.php"
            params = {
                'module': 'ProductSearch',
                'affiliate_id': affiliate_id,
                'website_id': website_id,
                'output': 'json',
                'search_term': 'sale',
                'results_per_page': 50
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    deals = self._parse_avantlink_response(data, affiliate_id)
                    
        except Exception as e:
            logger.error(f"Error fetching AvantLink deals: {e}")
            
        return deals

    async def fetch_awin_deals(self, config: Dict) -> List[Dict]:
        """AWIN (Affiliate Window) API"""
        deals = []
        
        try:
            publisher_id = config.get('publisher_id')
            api_token = config.get('api_token')
            
            if not all([publisher_id, api_token]):
                return []
                
            headers = {
                'Authorization': f'Bearer {api_token}',
                'Accept': 'application/json'
            }
            
            # AWIN Publishers API
            url = f"https://api.awin.com/publishers/{publisher_id}/vouchers"
            params = {
                'limit': 100,
                'status': 'active'
            }
            
            async with self.session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    deals = self._parse_awin_response(data)
                    
        except Exception as e:
            logger.error(f"Error fetching AWIN deals: {e}")
            
        return deals

    async def fetch_all_network_deals(self) -> List[Dict]:
        """Fetch deals from all configured networks"""
        all_deals = []
        
        # Get all active network configurations
        async with get_db() as db:
            result = await db.execute(
                select(AffiliateConfig).where(AffiliateConfig.is_active == True)
            )
            configs = result.scalars().all()
            
            tasks = []
            for config in configs:
                network_id = config.network_id
                config_data = config.config_data
                
                # Create fetch task based on network type
                if network_id == 'amazon':
                    tasks.append(self.fetch_amazon_deals(config_data))
                elif network_id == 'cj':
                    tasks.append(self.fetch_cj_deals(config_data))
                elif network_id == 'clickbank':
                    tasks.append(self.fetch_clickbank_deals(config_data))
                elif network_id == 'shareasale':
                    tasks.append(self.fetch_shareasale_deals(config_data))
                elif network_id == 'rakuten':
                    tasks.append(self.fetch_rakuten_deals(config_data))
                elif network_id == 'impact':
                    tasks.append(self.fetch_impact_deals(config_data))
                elif network_id == 'partnerize':
                    tasks.append(self.fetch_partnerize_deals(config_data))
                elif network_id == 'avantlink':
                    tasks.append(self.fetch_avantlink_deals(config_data))
                elif network_id == 'awin':
                    tasks.append(self.fetch_awin_deals(config_data))
            
            # Execute all tasks concurrently
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for result in results:
                    if isinstance(result, list):
                        all_deals.extend(result)
                    elif isinstance(result, Exception):
                        logger.error(f"Error in network fetch: {result}")
        
        return all_deals

    async def validate_compliance(self, deal: Dict, network_id: str) -> Dict[str, Any]:
        """Validate deal against network compliance terms"""
        network = self.networks.get(network_id, {})
        compliance_terms = network.get('compliance_terms', {})
        
        validation_result = {
            'compliant': True,
            'issues': [],
            'required_disclaimers': [],
            'link_modifications': {}
        }
        
        # Check attribution requirements
        if compliance_terms.get('attribution_required'):
            if not deal.get('affiliate_url') or 'tag=' not in deal.get('affiliate_url', ''):
                validation_result['issues'].append('Missing affiliate tracking')
                validation_result['compliant'] = False
        
        # Check data retention compliance
        retention = compliance_terms.get('data_retention', '30_days')
        if retention == '24_hours':
            validation_result['required_disclaimers'].append('Prices may change without notice')
        
        # Check content restrictions
        restrictions = compliance_terms.get('content_restrictions', [])
        for restriction in restrictions:
            if restriction == 'no_email_marketing':
                validation_result['required_disclaimers'].append('Not for email marketing use')
            elif restriction == 'social_media_approval_needed':
                validation_result['required_disclaimers'].append('Social media use requires approval')
        
        return validation_result

    # Parser methods for each network
    def _parse_amazon_response(self, xml_data: str, associate_tag: str) -> List[Dict]:
        deals = []
        try:
            root = ET.fromstring(xml_data)
            items = root.findall('.//Item')
            
            for item in items:
                title = item.find('.//Title')
                title = title.text if title is not None else "Unknown Product"
                
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
                            'source': 'amazon',
                            'network_id': 'amazon'
                        }
                        deals.append(deal)
        except Exception as e:
            logger.error(f"Error parsing Amazon XML: {e}")
        return deals

    def _parse_shareasale_response(self, data: str, affiliate_id: str) -> List[Dict]:
        deals = []
        try:
            # ShareASale returns pipe-delimited data
            lines = data.strip().split('\n')
            for line in lines[1:]:  # Skip header
                fields = line.split('|')
                if len(fields) >= 8:
                    deal = {
                        'title': fields[1],
                        'description': fields[2],
                        'original_price': float(fields[3]) if fields[3] else 0,
                        'sale_price': float(fields[4]) if fields[4] else 0,
                        'discount_percentage': float(fields[5]) if fields[5] else 0,
                        'store': fields[6],
                        'affiliate_url': f"https://www.shareasale.com/r.cfm?b={fields[7]}&u={affiliate_id}&m={fields[8]}",
                        'source': 'shareasale',
                        'network_id': 'shareasale'
                    }
                    deals.append(deal)
        except Exception as e:
            logger.error(f"Error parsing ShareASale data: {e}")
        return deals

    def _parse_rakuten_response(self, data: Dict) -> List[Dict]:
        deals = []
        try:
            for coupon in data.get('coupons', []):
                deal = {
                    'title': coupon.get('offerdescription', ''),
                    'description': coupon.get('restrictions', ''),
                    'original_price': 0,
                    'sale_price': 0,
                    'discount_percentage': 0,
                    'store': coupon.get('advertiser', ''),
                    'affiliate_url': coupon.get('clickurl', ''),
                    'source': 'rakuten',
                    'network_id': 'rakuten'
                }
                deals.append(deal)
        except Exception as e:
            logger.error(f"Error parsing Rakuten data: {e}")
        return deals

    def _parse_impact_response(self, data: Dict) -> List[Dict]:
        deals = []
        try:
            for promotion in data.get('Promotions', []):
                deal = {
                    'title': promotion.get('Name', ''),
                    'description': promotion.get('Description', ''),
                    'original_price': 0,
                    'sale_price': 0,
                    'discount_percentage': 0,
                    'store': promotion.get('CampaignName', ''),
                    'affiliate_url': promotion.get('TrackingLink', ''),
                    'source': 'impact',
                    'network_id': 'impact'
                }
                deals.append(deal)
        except Exception as e:
            logger.error(f"Error parsing Impact data: {e}")
        return deals

    def _parse_partnerize_response(self, data: Dict) -> List[Dict]:
        deals = []
        try:
            for creative in data.get('content', []):
                if creative.get('creative_type') == 'promotion':
                    deal = {
                        'title': creative.get('title', ''),
                        'description': creative.get('description', ''),
                        'original_price': 0,
                        'sale_price': 0,
                        'discount_percentage': 0,
                        'store': creative.get('campaign', {}).get('title', ''),
                        'affiliate_url': creative.get('tracking_link', ''),
                        'source': 'partnerize',
                        'network_id': 'partnerize'
                    }
                    deals.append(deal)
        except Exception as e:
            logger.error(f"Error parsing Partnerize data: {e}")
        return deals

    def _parse_avantlink_response(self, data: Dict, affiliate_id: str) -> List[Dict]:
        deals = []
        try:
            for product in data.get('results', []):
                if product.get('sale_price', 0) < product.get('price', 0):
                    deal = {
                        'title': product.get('product_name', ''),
                        'description': product.get('product_description', ''),
                        'original_price': float(product.get('price', 0)),
                        'sale_price': float(product.get('sale_price', 0)),
                        'discount_percentage': ((float(product.get('price', 0)) - float(product.get('sale_price', 0))) / float(product.get('price', 1))) * 100,
                        'store': product.get('merchant_name', ''),
                        'affiliate_url': f"https://www.avantlink.com/click.php?tt=cl&mi={product.get('merchant_id')}&pw={product.get('product_id')}&url={product.get('buy_url')}",
                        'source': 'avantlink',
                        'network_id': 'avantlink'
                    }
                    deals.append(deal)
        except Exception as e:
            logger.error(f"Error parsing AvantLink data: {e}")
        return deals

    def _parse_cj_response(self, data: Dict, website_id: str) -> List[Dict]:
        deals = []
        try:
            for product in data.get('products', []):
                if product.get('sale-price', 0) < product.get('price', 0):
                    deal = {
                        'title': product.get('name', ''),
                        'description': product.get('description', ''),
                        'original_price': float(product.get('price', 0)),
                        'sale_price': float(product.get('sale-price', 0)),
                        'discount_percentage': ((float(product.get('price', 0)) - float(product.get('sale-price', 0))) / float(product.get('price', 1))) * 100,
                        'store': product.get('advertiser-name', ''),
                        'affiliate_url': f"https://www.tkqlhce.com/click-{website_id}-{product.get('product-id')}",
                        'image_url': product.get('image-url', ''),
                        'source': 'cj',
                        'network_id': 'cj'
                    }
                    deals.append(deal)
        except Exception as e:
            logger.error(f"Error parsing CJ data: {e}")
        return deals

    def _parse_clickbank_response(self, data: Dict, nickname: str) -> List[Dict]:
        deals = []
        try:
            for product in data.get('products', []):
                deal = {
                    'title': product.get('title', ''),
                    'description': product.get('description', ''),
                    'original_price': float(product.get('price', 0)) if product.get('price') else 0,
                    'sale_price': float(product.get('price', 0)) if product.get('price') else 0,
                    'discount_percentage': 0,
                    'store': 'ClickBank',
                    'affiliate_url': f"https://{product.get('site')}.{nickname}.hop.clickbank.net/",
                    'source': 'clickbank',
                    'network_id': 'clickbank'
                }
                deals.append(deal)
        except Exception as e:
            logger.error(f"Error parsing ClickBank data: {e}")
        return deals

    def _parse_awin_response(self, data: Dict) -> List[Dict]:
        deals = []
        try:
            for voucher in data.get('vouchers', []):
                deal = {
                    'title': voucher.get('title', ''),
                    'description': voucher.get('description', ''),
                    'original_price': 0,
                    'sale_price': 0,
                    'discount_percentage': 0,
                    'store': voucher.get('advertiser', {}).get('name', ''),
                    'affiliate_url': voucher.get('deeplink', ''),
                    'source': 'awin',
                    'network_id': 'awin'
                }
                deals.append(deal)
        except Exception as e:
            logger.error(f"Error parsing AWIN data: {e}")
        return deals

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

    def _extract_price(self, price_str: str) -> float:
        """Extract numeric price from formatted string"""
        try:
            import re
            price_match = re.search(r'[\d,]+\.?\d*', price_str.replace(',', ''))
            if price_match:
                return float(price_match.group())
        except:
            pass
        return 0.0