import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from database import async_session, init_database
from models import Deal as DealModel

async def create_sample_deals():
    """Create sample deals for demonstration"""
    sample_deals = [
        # Top Deals
        {
            "title": "Apple iPhone 15 Pro - 128GB Space Black",
            "description": "Latest iPhone 15 Pro with A17 Pro chip, titanium design, and advanced camera system. Perfect for photography enthusiasts.",
            "original_price": Decimal("1199.00"),
            "sale_price": Decimal("999.99"),
            "discount_percentage": 17,
            "image_url": "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400",
            "affiliate_url": "https://example.com/iphone15pro",
            "store": "Apple Store",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Electronics",
            "rating": Decimal("4.8"),
            "review_count": 2847,
            "deal_type": "top",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("9.2"),
            "popularity": 850,
            "click_count": 120,
            "share_count": 45
        },
        {
            "title": "Samsung 75\" Neo QLED 4K Smart TV",
            "description": "Quantum HDR technology with AI-powered upscaling. Experience stunning picture quality with deep blacks and vibrant colors.",
            "original_price": Decimal("2499.99"),
            "sale_price": Decimal("1899.99"),
            "discount_percentage": 24,
            "image_url": "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400",
            "affiliate_url": "https://example.com/samsung-tv",
            "store": "Best Buy",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Electronics",
            "rating": Decimal("4.6"),
            "review_count": 1523,
            "deal_type": "top",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("8.9"),
            "popularity": 720,
            "click_count": 98,
            "share_count": 32
        },
        {
            "title": "Nike Air Max 270 Running Shoes",
            "description": "Comfortable running shoes with Air Max technology. Perfect for daily workouts and casual wear.",
            "original_price": Decimal("150.00"),
            "sale_price": Decimal("89.99"),
            "discount_percentage": 40,
            "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
            "affiliate_url": "https://example.com/nike-airmax",
            "store": "Nike",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Fashion",
            "rating": Decimal("4.5"),
            "review_count": 892,
            "deal_type": "top",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("8.7"),
            "popularity": 650,
            "click_count": 156,
            "share_count": 28
        },
        
        # Hot Deals
        {
            "title": "Sony WH-1000XM5 Wireless Noise Canceling Headphones",
            "description": "Industry-leading noise cancellation with exceptional sound quality. 30-hour battery life with quick charge.",
            "original_price": Decimal("399.99"),
            "sale_price": Decimal("279.99"),
            "discount_percentage": 30,
            "image_url": "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400",
            "affiliate_url": "https://example.com/sony-headphones",
            "store": "Amazon",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Electronics",
            "rating": Decimal("4.7"),
            "review_count": 3421,
            "deal_type": "hot",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("9.1"),
            "popularity": 420,
            "click_count": 234,
            "share_count": 67,
            "expires_at": datetime.utcnow() + timedelta(days=2)
        },
        {
            "title": "Dyson V15 Detect Cordless Vacuum",
            "description": "Advanced cordless vacuum with laser detection technology. Powerful suction and intelligent cleaning.",
            "original_price": Decimal("749.99"),
            "sale_price": Decimal("549.99"),
            "discount_percentage": 27,
            "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
            "affiliate_url": "https://example.com/dyson-vacuum",
            "store": "Dyson",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Home & Garden",
            "rating": Decimal("4.6"),
            "review_count": 1876,
            "deal_type": "hot",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("8.8"),
            "popularity": 380,
            "click_count": 187,
            "share_count": 41,
            "expires_at": datetime.utcnow() + timedelta(days=1)
        },
        {
            "title": "MacBook Air M3 - 13-inch, 256GB",
            "description": "New MacBook Air with M3 chip. Ultra-thin design with all-day battery life and stunning Liquid Retina display.",
            "original_price": Decimal("1299.00"),
            "sale_price": Decimal("1099.99"),
            "discount_percentage": 15,
            "image_url": "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400",
            "affiliate_url": "https://example.com/macbook-air",
            "store": "Apple Store",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Electronics",
            "rating": Decimal("4.8"),
            "review_count": 1247,
            "deal_type": "hot",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("9.0"),
            "popularity": 590,
            "click_count": 298,
            "share_count": 78,
            "expires_at": datetime.utcnow() + timedelta(days=3)
        },
        {
            "title": "Instant Pot Duo 7-in-1 Electric Pressure Cooker",
            "description": "7 appliances in 1: pressure cooker, slow cooker, rice cooker, steamer, sauté, yogurt maker & warmer.",
            "original_price": Decimal("119.99"),
            "sale_price": Decimal("69.99"),
            "discount_percentage": 42,
            "image_url": "https://images.unsplash.com/photo-1556909114-5e611ea00f53?w=400",
            "affiliate_url": "https://example.com/instant-pot",
            "store": "Target",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Home & Kitchen",
            "rating": Decimal("4.5"),
            "review_count": 4523,
            "deal_type": "hot",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("8.6"),
            "popularity": 310,
            "click_count": 142,
            "share_count": 29,
            "expires_at": datetime.utcnow() + timedelta(hours=18)
        },
        
        # Latest Deals
        {
            "title": "Amazon Echo Dot (5th Gen) Smart Speaker",
            "description": "Our most popular smart speaker with Alexa. Rich sound, smart home hub, and voice control.",
            "original_price": Decimal("49.99"),
            "sale_price": Decimal("29.99"),
            "discount_percentage": 40,
            "image_url": "https://images.unsplash.com/photo-1589492477829-5e65395b66cc?w=400",
            "affiliate_url": "https://example.com/echo-dot",
            "store": "Amazon",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Electronics",
            "rating": Decimal("4.4"),
            "review_count": 8765,
            "deal_type": "latest",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("8.3"),
            "popularity": 125,
            "click_count": 67,
            "share_count": 12
        },
        {
            "title": "Levi's 501 Original Fit Jeans",
            "description": "Classic straight leg jeans with authentic fit and iconic style. Made with premium denim.",
            "original_price": Decimal("59.99"),
            "sale_price": Decimal("39.99"),
            "discount_percentage": 33,
            "image_url": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400",
            "affiliate_url": "https://example.com/levis-jeans",
            "store": "Levi's",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Fashion",
            "rating": Decimal("4.3"),
            "review_count": 2156,
            "deal_type": "latest",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("8.1"),
            "popularity": 89,
            "click_count": 45,
            "share_count": 8
        },
        {
            "title": "Fitbit Charge 6 Fitness Tracker",
            "description": "Advanced fitness tracker with GPS, heart rate monitoring, and 6+ day battery life.",
            "original_price": Decimal("199.99"),
            "sale_price": Decimal("149.99"),
            "discount_percentage": 25,
            "image_url": "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400",
            "affiliate_url": "https://example.com/fitbit-charge6",
            "store": "Best Buy",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Health & Fitness",
            "rating": Decimal("4.2"),
            "review_count": 1324,
            "deal_type": "latest",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("8.4"),
            "popularity": 156,
            "click_count": 78,
            "share_count": 15
        },
        {
            "title": "KitchenAid Stand Mixer - 5 Quart",
            "description": "Professional-grade stand mixer perfect for baking. Comes with dough hook, flat beater, and wire whip.",
            "original_price": Decimal("429.99"),
            "sale_price": Decimal("329.99"),
            "discount_percentage": 23,
            "image_url": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400",
            "affiliate_url": "https://example.com/kitchenaid-mixer",
            "store": "Williams Sonoma",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Home & Kitchen",
            "rating": Decimal("4.7"),
            "review_count": 987,
            "deal_type": "latest",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("8.5"),
            "popularity": 201,
            "click_count": 89,
            "share_count": 23
        },
        {
            "title": "Nintendo Switch OLED Model",
            "description": "Enhanced Nintendo Switch with vibrant 7-inch OLED screen and improved audio for handheld mode.",
            "original_price": Decimal("349.99"),
            "sale_price": Decimal("299.99"),
            "discount_percentage": 14,
            "image_url": "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400",
            "affiliate_url": "https://example.com/nintendo-switch",
            "store": "GameStop",
            "store_logo_url": "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100",
            "category": "Gaming",
            "rating": Decimal("4.6"),
            "review_count": 2103,
            "deal_type": "latest",
            "is_active": True,
            "is_ai_approved": True,
            "ai_score": Decimal("8.2"),
            "popularity": 178,
            "click_count": 134,
            "share_count": 31
        }
    ]
    
    async with async_session() as session:
        try:
            for deal_data in sample_deals:
                deal = DealModel(
                    id=str(uuid.uuid4()),
                    **deal_data
                )
                session.add(deal)
            
            await session.commit()
            print(f"Created {len(sample_deals)} sample deals successfully!")
            
        except Exception as e:
            await session.rollback()
            print(f"Error creating sample deals: {e}")
            raise

async def main():
    """Initialize database and create sample data"""
    print("Initializing database...")
    await init_database()
    
    print("Creating sample deals...")
    await create_sample_deals()
    
    print("Sample data creation completed!")

if __name__ == "__main__":
    asyncio.run(main())