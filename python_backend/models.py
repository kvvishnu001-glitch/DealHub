from sqlalchemy import Column, String, Text, Numeric, Integer, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from database import Base

# SQLAlchemy Models
class Deal(Base):
    __tablename__ = "deals"
    
    id = Column(String, primary_key=True)
    title = Column(Text, nullable=False)
    description = Column(Text)
    original_price = Column(Numeric(10, 2), nullable=False)
    sale_price = Column(Numeric(10, 2), nullable=False)
    discount_percentage = Column(Integer, nullable=False)
    image_url = Column(Text)
    affiliate_url = Column(Text, nullable=False)
    store = Column(String, nullable=False)
    store_logo_url = Column(Text)
    category = Column(String, nullable=False)
    rating = Column(Numeric(2, 1))
    review_count = Column(Integer, default=0)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    is_ai_approved = Column(Boolean, default=False)
    status = Column(String, default='pending')  # pending, approved, rejected, deleted
    ai_score = Column(Numeric(3, 1))
    ai_reasons = Column(JSON)
    popularity = Column(Integer, default=0)
    click_count = Column(Integer, default=0)
    share_count = Column(Integer, default=0)
    deal_type = Column(String, nullable=False, default='latest')
    source_api = Column(String)
    coupon_code = Column(String, nullable=True)  # Store coupon/promo code
    coupon_required = Column(Boolean, default=False)  # Whether deal requires coupon
    rejected_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    clicks = relationship("DealClick", back_populates="deal")
    shares = relationship("SocialShare", back_populates="deal")

class DealClick(Base):
    __tablename__ = "deal_clicks"
    
    id = Column(String, primary_key=True)
    deal_id = Column(String, ForeignKey("deals.id"), nullable=False)
    ip_address = Column(String)
    user_agent = Column(Text)
    referrer = Column(Text)
    clicked_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    deal = relationship("Deal", back_populates="clicks")

class SocialShare(Base):
    __tablename__ = "social_shares"
    
    id = Column(String, primary_key=True)
    deal_id = Column(String, ForeignKey("deals.id"), nullable=False)
    platform = Column(String, nullable=False)
    ip_address = Column(String)
    short_url = Column(String)  # Store generated short URL
    shared_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    deal = relationship("Deal", back_populates="shares")

class ShortUrl(Base):
    __tablename__ = "short_urls"
    
    id = Column(String, primary_key=True)
    short_code = Column(String, unique=True, nullable=False, index=True)
    original_url = Column(Text, nullable=False)
    deal_id = Column(String, ForeignKey("deals.id"), nullable=True)
    click_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    deal = relationship("Deal")

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True)
    first_name = Column(String)
    last_name = Column(String)
    profile_image_url = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class AdminUser(Base):
    __tablename__ = "admin_users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class Session(Base):
    __tablename__ = "sessions"
    
    sid = Column(String, primary_key=True)
    sess = Column(JSON, nullable=False)
    expire = Column(DateTime, nullable=False)

# Pydantic Models
class DealBase(BaseModel):
    title: str
    description: Optional[str] = None
    original_price: float
    sale_price: float
    discount_percentage: int
    image_url: Optional[str] = None
    affiliate_url: str
    store: str
    store_logo_url: Optional[str] = None
    category: str
    rating: Optional[float] = None
    review_count: Optional[int] = 0
    expires_at: Optional[datetime] = None
    deal_type: str = 'latest'
    source_api: Optional[str] = None
    coupon_code: Optional[str] = None
    coupon_required: Optional[bool] = False

class DealCreate(DealBase):
    pass

class DealResponse(DealBase):
    id: str
    is_active: bool
    is_ai_approved: bool
    ai_score: Optional[float] = None
    ai_reasons: Optional[Dict[str, Any]] = None
    popularity: int
    click_count: int
    share_count: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class DealClickCreate(BaseModel):
    deal_id: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    referrer: Optional[str] = None

class SocialShareCreate(BaseModel):
    deal_id: str
    platform: str
    ip_address: Optional[str] = None
    short_url: Optional[str] = None

class ShortUrlCreate(BaseModel):
    short_code: str
    original_url: str
    deal_id: Optional[str] = None

class ShortUrlResponse(BaseModel):
    id: str
    short_code: str
    original_url: str
    deal_id: Optional[str]
    click_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# New models for affiliate network management
class AffiliateNetwork(Base):
    __tablename__ = "affiliate_networks"
    
    id = Column(Integer, primary_key=True, index=True)
    network_id = Column(String(50), unique=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    api_type = Column(String(50))  # api, ftp, csv
    base_url = Column(String(500))
    compliance_terms = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class AffiliateConfig(Base):
    __tablename__ = "affiliate_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    network_id = Column(String(50), unique=True, index=True)
    network_name = Column(String(200), nullable=False)
    config_data = Column(JSON)  # API keys, endpoints, etc.
    compliance_terms = Column(JSON)
    is_active = Column(Boolean, default=True)
    last_sync = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class ComplianceLog(Base):
    __tablename__ = "compliance_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    deal_id = Column(String(36), ForeignKey("deals.id"))
    network_id = Column(String(50))
    compliance_check = Column(JSON)
    is_compliant = Column(Boolean, default=True)
    issues_found = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())

# Pydantic models for affiliate networks
class AffiliateNetworkCreate(BaseModel):
    network_id: str
    name: str
    description: Optional[str] = None
    api_type: str
    base_url: Optional[str] = None
    compliance_terms: Dict[str, Any]

class AffiliateConfigCreate(BaseModel):
    network_id: str
    network_name: str
    config_data: Dict[str, Any]
    compliance_terms: Dict[str, Any]

class AffiliateConfigResponse(BaseModel):
    id: int
    network_id: str
    network_name: str
    config_data: Dict[str, Any]
    compliance_terms: Dict[str, Any]
    is_active: bool
    last_sync: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class Analytics(BaseModel):
    total_deals: int
    ai_approved: int
    pending_review: int
    clicks_today: int

class UserResponse(BaseModel):
    id: str
    email: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    profile_image_url: Optional[str]
    
    class Config:
        from_attributes = True

class AdminUserCreate(BaseModel):
    username: str
    email: str
    password: str

class AdminUserLogin(BaseModel):
    username: str
    password: str

class AdminUserResponse(BaseModel):
    id: str
    username: str
    email: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class AdminMetrics(BaseModel):
    total_deals: int
    ai_approved_deals: int
    pending_deals: int
    total_clicks: int
    total_shares: int
    revenue_estimate: float
    top_categories: List[Dict[str, Any]]
    top_stores: List[Dict[str, Any]]
    recent_activity: List[Dict[str, Any]]