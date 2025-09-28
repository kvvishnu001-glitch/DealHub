from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from database import get_db
from models import User as UserModel, UserResponse

router = APIRouter()

@router.get("/user", response_model=UserResponse)
async def get_current_user_info(request: Request, db: AsyncSession = Depends(get_db)):
    """Get current user info - returns 401 if not authenticated"""
    # For now, we'll implement a simple mock authentication
    # In a real implementation, this would check session/JWT tokens
    
    # Check if user is accessing from admin route or has admin session
    # This is a simplified version - in production you'd have proper session management
    user_id = request.headers.get("X-User-ID")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized"
        )
    
    # Get user from database
    query = select(UserModel).where(UserModel.id == user_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return UserResponse.model_validate(user)

@router.get("/login")
async def login():
    """Redirect to login - in production this would integrate with Replit Auth"""
    return {"message": "Redirect to login", "url": "/api/login"}

@router.get("/logout")
async def logout():
    """Logout user"""
    return {"message": "Logged out successfully"}