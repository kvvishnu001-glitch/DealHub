import csv
import json
import xml.etree.ElementTree as ET
import pandas as pd
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging
from datetime import datetime
import re

logger = logging.getLogger(__name__)

class DealFileProcessor:
    """Process uploaded deal files from various affiliate networks"""
    
    def __init__(self):
        self.supported_formats = {
            'csv': self._process_csv,
            'xls': self._process_excel,
            'xlsx': self._process_excel,
            'xml': self._process_xml,
            'json': self._process_json,
            'txt': self._process_text
        }
        
        # Network-specific field mappings
        self.network_mappings = {
            'amazon': {
                'title': ['title', 'name', 'product_name', 'item_name'],
                'description': ['description', 'product_description', 'details'],
                'price': ['price', 'sale_price', 'current_price', 'amount'],
                'original_price': ['original_price', 'list_price', 'retail_price', 'msrp'],
                'discount_percent': ['discount_percent', 'discount', 'savings_percent'],
                'image_url': ['image_url', 'image', 'picture_url', 'photo_url'],
                'product_url': ['product_url', 'url', 'link', 'affiliate_url'],
                'category': ['category', 'product_category', 'department'],
                'brand': ['brand', 'manufacturer', 'vendor'],
                'rating': ['rating', 'customer_rating', 'review_score'],
                'availability': ['availability', 'in_stock', 'stock_status']
            },
            'cj': {
                'title': ['name', 'product_name', 'advertiser_name'],
                'description': ['description', 'short_description', 'long_description'],
                'price': ['sale_price', 'price', 'retail_price'],
                'original_price': ['original_price', 'msrp', 'list_price'],
                'discount_percent': ['discount_percent', 'commission_rate'],
                'image_url': ['image_url', 'thumbnail_url', 'large_image_url'],
                'product_url': ['click_url', 'buy_url', 'product_url'],
                'category': ['category', 'primary_category', 'sub_category'],
                'brand': ['advertiser_name', 'brand', 'merchant'],
                'commission': ['commission_amount', 'payout']
            },
            'shareasale': {
                'title': ['merchantname', 'product', 'name', 'title'],
                'description': ['description', 'comments', 'details'],
                'price': ['price', 'saleprice', 'retail_price'],
                'original_price': ['price', 'msrp', 'original_price'],
                'discount_percent': ['discount', 'savings_percent'],
                'image_url': ['thumb', 'image', 'picture'],
                'product_url': ['directurl', 'url', 'link'],
                'category': ['category', 'subcategory'],
                'brand': ['merchantname', 'brand'],
                'commission': ['commission', 'payout']
            }
        }

    async def process_file(self, file_path: str, network: str, notes: str = "") -> Dict[str, Any]:
        """Process an uploaded deal file"""
        try:
            file_ext = Path(file_path).suffix.lower().lstrip('.')
            
            if file_ext not in self.supported_formats:
                raise ValueError(f"Unsupported file format: {file_ext}")
            
            processor = self.supported_formats[file_ext]
            raw_data = processor(file_path)
            
            # Map and validate deals
            deals = self._map_deals(raw_data, network)
            validated_deals = self._validate_deals(deals, network)
            
            return {
                'success': True,
                'deals_processed': len(validated_deals),
                'deals_valid': len([d for d in validated_deals if d.get('valid')]),
                'deals': validated_deals,
                'file_info': {
                    'name': Path(file_path).name,
                    'format': file_ext,
                    'network': network,
                    'notes': notes,
                    'processed_at': datetime.utcnow().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {e}")
            return {
                'success': False,
                'error': str(e),
                'deals_processed': 0
            }

    def _process_csv(self, file_path: str) -> List[Dict]:
        """Process CSV files"""
        deals = []
        with open(file_path, 'r', encoding='utf-8-sig') as file:
            # Try to detect delimiter
            sample = file.read(1024)
            file.seek(0)
            
            delimiter = ','
            if '\t' in sample and sample.count('\t') > sample.count(','):
                delimiter = '\t'
            
            reader = csv.DictReader(file, delimiter=delimiter)
            for row in reader:
                # Clean empty keys and values
                clean_row = {k.strip(): v.strip() for k, v in row.items() if k and v}
                if clean_row:
                    deals.append(clean_row)
        
        return deals

    def _process_excel(self, file_path: str) -> List[Dict]:
        """Process Excel files (.xls, .xlsx)"""
        try:
            # Try different sheet names commonly used for deals
            df = pd.read_excel(file_path, sheet_name=None)
            
            # Find the sheet with the most data (likely the main deals sheet)
            main_sheet = max(df.keys(), key=lambda k: len(df[k]))
            data = df[main_sheet]
            
            # Convert to list of dictionaries
            deals = data.where(pd.notnull(data), '').to_dict('records')
            
            # Clean empty entries
            return [
                {k: str(v).strip() for k, v in deal.items() if v != ''}
                for deal in deals if any(v != '' for v in deal.values())
            ]
            
        except Exception as e:
            logger.error(f"Error processing Excel file: {e}")
            return []

    def _process_xml(self, file_path: str) -> List[Dict]:
        """Process XML files"""
        deals = []
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            # Try to find deal/product elements
            deal_elements = []
            
            # Common XML structures
            for tag in ['product', 'deal', 'item', 'offer']:
                elements = root.findall(f".//{tag}")
                if elements:
                    deal_elements = elements
                    break
            
            # If no specific elements found, use direct children
            if not deal_elements:
                deal_elements = list(root)
            
            for element in deal_elements:
                deal = {}
                for child in element:
                    if child.text and child.text.strip():
                        deal[child.tag] = child.text.strip()
                
                # Also check attributes
                for attr_name, attr_value in element.attrib.items():
                    if attr_value and attr_value.strip():
                        deal[attr_name] = attr_value.strip()
                
                if deal:
                    deals.append(deal)
                    
        except Exception as e:
            logger.error(f"Error processing XML file: {e}")
            
        return deals

    def _process_json(self, file_path: str) -> List[Dict]:
        """Process JSON files"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
            
            # Handle different JSON structures
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                # Try common keys for deal arrays
                for key in ['deals', 'products', 'offers', 'items', 'data']:
                    if key in data and isinstance(data[key], list):
                        return data[key]
                
                # If it's a single deal object, return as list
                return [data]
            
            return []
            
        except Exception as e:
            logger.error(f"Error processing JSON file: {e}")
            return []

    def _process_text(self, file_path: str) -> List[Dict]:
        """Process plain text files"""
        deals = []
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Try to parse as tab-delimited or pipe-delimited
            lines = content.strip().split('\n')
            if len(lines) < 2:
                return deals
            
            # Detect delimiter
            first_line = lines[0]
            delimiter = '\t' if '\t' in first_line else '|' if '|' in first_line else ','
            
            headers = [h.strip() for h in first_line.split(delimiter)]
            
            for line in lines[1:]:
                values = [v.strip() for v in line.split(delimiter)]
                if len(values) == len(headers):
                    deal = dict(zip(headers, values))
                    if any(v for v in deal.values()):  # Skip empty rows
                        deals.append(deal)
                        
        except Exception as e:
            logger.error(f"Error processing text file: {e}")
            
        return deals

    def _map_deals(self, raw_deals: List[Dict], network: str) -> List[Dict]:
        """Map raw deal data to standardized format"""
        mapping = self.network_mappings.get(network, self.network_mappings['amazon'])
        standardized_deals = []
        
        for raw_deal in raw_deals:
            deal = {}
            
            # Map fields using network-specific mappings
            for standard_field, possible_fields in mapping.items():
                value = None
                for field in possible_fields:
                    # Try exact match first
                    if field in raw_deal:
                        value = raw_deal[field]
                        break
                    
                    # Try case-insensitive match
                    for key in raw_deal.keys():
                        if key.lower() == field.lower():
                            value = raw_deal[key]
                            break
                    
                    if value:
                        break
                
                if value and str(value).strip():
                    deal[standard_field] = str(value).strip()
            
            # Extract additional fields that might be useful
            for key, value in raw_deal.items():
                if key.lower() not in [field.lower() for fields in mapping.values() for field in fields]:
                    if value and str(value).strip():
                        deal[f'extra_{key.lower()}'] = str(value).strip()
            
            if deal:
                deal['source'] = 'file_upload'
                deal['network'] = network
                deal['upload_timestamp'] = datetime.utcnow().isoformat()
                standardized_deals.append(deal)
        
        return standardized_deals

    def _validate_deals(self, deals: List[Dict], network: str) -> List[Dict]:
        """Validate and clean deal data"""
        validated_deals = []
        
        for deal in deals:
            # Required fields validation
            is_valid = True
            validation_errors = []
            
            # Check required fields
            required_fields = ['title']
            for field in required_fields:
                if not deal.get(field):
                    validation_errors.append(f"Missing {field}")
                    is_valid = False
            
            # Validate price format
            if deal.get('price'):
                try:
                    # Extract numeric value from price string
                    price_str = re.sub(r'[^\d.]', '', str(deal['price']))
                    if price_str:
                        deal['price'] = float(price_str)
                    else:
                        validation_errors.append("Invalid price format")
                        is_valid = False
                except ValueError:
                    validation_errors.append("Invalid price format")
                    is_valid = False
            
            # Validate original price
            if deal.get('original_price'):
                try:
                    price_str = re.sub(r'[^\d.]', '', str(deal['original_price']))
                    if price_str:
                        deal['original_price'] = float(price_str)
                except ValueError:
                    deal.pop('original_price', None)
            
            # Calculate discount if both prices available
            if deal.get('price') and deal.get('original_price'):
                try:
                    discount = ((deal['original_price'] - deal['price']) / deal['original_price']) * 100
                    deal['discount_percent'] = round(discount, 2)
                except (ZeroDivisionError, TypeError):
                    pass
            
            # Validate URL format
            if deal.get('product_url'):
                if not deal['product_url'].startswith(('http://', 'https://')):
                    deal['product_url'] = 'https://' + deal['product_url']
            
            # Set deal status based on validation
            deal['valid'] = is_valid
            deal['validation_errors'] = validation_errors
            deal['status'] = 'pending' if is_valid else 'invalid'
            
            validated_deals.append(deal)
        
        return validated_deals