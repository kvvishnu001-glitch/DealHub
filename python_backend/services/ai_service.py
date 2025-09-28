"""
AI Service for Deal Validation and Enhancement
Uses OpenAI GPT-4o to validate, categorize, and enhance deal information
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import openai
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=os.getenv('OPENAI_API_KEY')
        )
        
    async def validate_and_enhance_deal(self, raw_deal: Dict) -> Dict[str, Any]:
        """
        Use AI to validate, categorize, and enhance deal information
        
        Args:
            raw_deal: Raw deal data from affiliate networks
            
        Returns:
            Dict containing validation results and enhanced data
        """
        
        try:
            # Prepare the deal data for AI analysis
            deal_info = {
                'title': raw_deal.get('title', ''),
                'description': raw_deal.get('description', ''),
                'store': raw_deal.get('store', ''),
                'original_price': raw_deal.get('original_price', 0),
                'sale_price': raw_deal.get('sale_price', 0),
                'discount_percentage': raw_deal.get('discount_percentage', 0),
                'source': raw_deal.get('source', 'unknown')
            }
            
            # Create AI prompt for deal validation
            prompt = self._create_validation_prompt(deal_info)
            
            # Call OpenAI API
            response = await self.client.chat.completions.create(
                model="gpt-4o",  # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
                messages=[
                    {
                        "role": "system",
                        "content": """You are a deal validation expert for an e-commerce deals platform. 
                        Analyze deals for legitimacy, quality, and commercial viability. 
                        Respond only with valid JSON in the exact format requested."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=1000
            )
            
            # Parse AI response
            ai_response = json.loads(response.choices[0].message.content)
            
            # Validate and structure the response
            return self._process_ai_response(ai_response, deal_info)
            
        except Exception as e:
            logger.error(f"Error in AI deal validation: {e}")
            # Return default validation result
            return self._create_default_response(raw_deal)
    
    def _create_validation_prompt(self, deal_info: Dict) -> str:
        """Create a comprehensive prompt for deal validation"""
        
        return f"""
        Analyze this deal and provide validation results in JSON format:

        DEAL INFORMATION:
        Title: {deal_info['title']}
        Description: {deal_info['description']}
        Store: {deal_info['store']}
        Original Price: ${deal_info['original_price']}
        Sale Price: ${deal_info['sale_price']}
        Discount: {deal_info['discount_percentage']}%
        Source: {deal_info['source']}

        Please analyze this deal and respond with JSON containing:

        {{
            "is_valid": true/false,
            "quality_score": 0-10,
            "category": "Electronics|Clothing|Home & Garden|Sports|Books|Toys|Beauty|Automotive|Food|Health|Other",
            "deal_type": "regular|hot|top",
            "enhanced_title": "improved title if needed",
            "enhanced_description": "improved description",
            "validation_reasons": ["reason1", "reason2"],
            "risk_factors": ["risk1", "risk2"],
            "commercial_viability": 0-10,
            "target_audience": "description of target audience",
            "seasonal_relevance": 0-10,
            "price_competitiveness": 0-10,
            "brand_reputation": 0-10
        }}

        VALIDATION CRITERIA:
        1. Is this a legitimate deal (not spam, scam, or fake)?
        2. Are the prices reasonable and realistic?
        3. Is the discount percentage accurate?
        4. Does the product/service have commercial value?
        5. Is the deal description clear and helpful?
        6. Rate overall quality from 0-10 (reject if below 6)

        CATEGORIZATION:
        - Assign the most appropriate category
        - Determine if it's regular, hot (great discount), or top (exceptional deal)
        - Consider seasonal relevance and market demand

        ENHANCEMENT:
        - Improve title for SEO and clarity if needed
        - Enhance description with key benefits and features
        - Keep original meaning but make it more compelling
        """
    
    def _process_ai_response(self, ai_response: Dict, original_deal: Dict) -> Dict[str, Any]:
        """Process and validate AI response"""
        
        try:
            # Ensure all required fields are present
            processed_response = {
                'is_valid': ai_response.get('is_valid', False),
                'quality_score': max(0, min(10, ai_response.get('quality_score', 5))),
                'category': ai_response.get('category', 'Other'),
                'deal_type': ai_response.get('deal_type', 'regular'),
                'enhanced_title': ai_response.get('enhanced_title', original_deal.get('title', '')),
                'enhanced_description': ai_response.get('enhanced_description', original_deal.get('description', '')),
                'validation_reasons': ai_response.get('validation_reasons', []),
                'risk_factors': ai_response.get('risk_factors', []),
                'commercial_viability': max(0, min(10, ai_response.get('commercial_viability', 5))),
                'target_audience': ai_response.get('target_audience', 'General consumers'),
                'seasonal_relevance': max(0, min(10, ai_response.get('seasonal_relevance', 5))),
                'price_competitiveness': max(0, min(10, ai_response.get('price_competitiveness', 5))),
                'brand_reputation': max(0, min(10, ai_response.get('brand_reputation', 5))),
                'ai_analysis_timestamp': datetime.utcnow().isoformat(),
                'model_used': 'gpt-4o'
            }
            
            # Additional validation logic
            if processed_response['quality_score'] >= 8.5:
                processed_response['auto_approve'] = True
            elif processed_response['quality_score'] < 6.0:
                processed_response['auto_reject'] = True
                processed_response['is_valid'] = False
            
            return processed_response
            
        except Exception as e:
            logger.error(f"Error processing AI response: {e}")
            return self._create_default_response(original_deal)
    
    def _create_default_response(self, deal_info: Dict) -> Dict[str, Any]:
        """Create a default response when AI validation fails"""
        
        return {
            'is_valid': False,
            'quality_score': 3.0,
            'category': 'Other',
            'deal_type': 'regular',
            'enhanced_title': deal_info.get('title', 'Unknown Deal'),
            'enhanced_description': deal_info.get('description', 'Deal details unavailable'),
            'validation_reasons': ['AI validation failed'],
            'risk_factors': ['Unable to validate automatically'],
            'commercial_viability': 3,
            'target_audience': 'Unknown',
            'seasonal_relevance': 5,
            'price_competitiveness': 5,
            'brand_reputation': 5,
            'ai_analysis_timestamp': datetime.utcnow().isoformat(),
            'model_used': 'fallback',
            'auto_reject': True
        }

    async def categorize_deal(self, title: str, description: str) -> str:
        """
        Quickly categorize a deal using AI
        """
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "Categorize this product into one of these categories: Electronics, Clothing, Home & Garden, Sports, Books, Toys, Beauty, Automotive, Food, Health. Respond with just the category name."
                    },
                    {
                        "role": "user",
                        "content": f"Title: {title}\nDescription: {description}"
                    }
                ],
                temperature=0.1,
                max_tokens=20
            )
            
            category = response.choices[0].message.content.strip()
            
            # Validate category
            valid_categories = [
                'Electronics', 'Clothing', 'Home & Garden', 'Sports', 
                'Books', 'Toys', 'Beauty', 'Automotive', 'Food', 'Health'
            ]
            
            return category if category in valid_categories else 'Other'
            
        except Exception as e:
            logger.error(f"Error in AI categorization: {e}")
            return 'Other'

    async def enhance_deal_description(self, title: str, basic_description: str) -> str:
        """
        Enhance a basic deal description with AI
        """
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "Enhance this product description to be more compelling and informative for deal seekers. Keep it concise (2-3 sentences max) and focus on key benefits and value proposition."
                    },
                    {
                        "role": "user",
                        "content": f"Product: {title}\nBasic Description: {basic_description}"
                    }
                ],
                temperature=0.4,
                max_tokens=150
            )
            
            enhanced = response.choices[0].message.content.strip()
            return enhanced if enhanced else basic_description
            
        except Exception as e:
            logger.error(f"Error enhancing description: {e}")
            return basic_description

    async def detect_deal_quality(self, deal_data: Dict) -> float:
        """
        Use AI to detect deal quality and assign a score
        """
        try:
            prompt = f"""
            Rate this deal quality from 0-10 based on:
            - Discount percentage and price competitiveness
            - Product popularity and brand reputation  
            - Deal legitimacy and value proposition
            
            Deal: {deal_data.get('title', '')}
            Store: {deal_data.get('store', '')}
            Original: ${deal_data.get('original_price', 0)}
            Sale: ${deal_data.get('sale_price', 0)}
            Discount: {deal_data.get('discount_percentage', 0)}%
            
            Respond with just a number from 0-10.
            """
            
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a deal quality expert. Rate deals objectively from 0-10."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=10
            )
            
            try:
                score = float(response.choices[0].message.content.strip())
                return max(0, min(10, score))
            except ValueError:
                return 5.0
                
        except Exception as e:
            logger.error(f"Error detecting deal quality: {e}")
            return 5.0