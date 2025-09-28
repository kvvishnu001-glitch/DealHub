import os
import tempfile
import csv
import json
import io
import uuid
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from database import get_db
from models import Deal

router = APIRouter()

@router.post("/upload-deals")
async def upload_deal_file(
    file: UploadFile = File(...),
    network: str = Form(...),
    description: str = Form(""),
    db: AsyncSession = Depends(get_db)
):
    """Simple file upload endpoint"""
    
    try:
        # Read file content
        content = await file.read()
        
        if not content:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Parse CSV content
        csv_content = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        
        saved_deals = []
        processed_count = 0
        
        for row in csv_reader:
            processed_count += 1
            try:
                # Check if AI review is needed
                needs_ai_review = row.get('needs_ai_review', 'true').lower() == 'true'
                
                # Map CSV fields to deal model (all mandatory fields included)
                deal_data = {
                    'id': str(uuid.uuid4()),  # Generate unique ID
                    'title': row.get('title', ''),
                    'description': row.get('description', ''),
                    'sale_price': float(row.get('sale_price', 0)) if row.get('sale_price') else 0,
                    'original_price': float(row.get('original_price', 0)) if row.get('original_price') else 0,
                    'discount_percentage': int(row.get('discount_percentage', 0)) if row.get('discount_percentage') else 0,
                    'image_url': row.get('image_url', ''),
                    'affiliate_url': row.get('affiliate_url', ''),
                    'store': row.get('store', network.title()),
                    'category': row.get('category', 'General'),
                    'rating': float(row.get('rating', 0)) if row.get('rating') else None,
                    'deal_type': row.get('deal_type', 'latest'),
                    'status': 'approved' if not needs_ai_review else 'pending',
                    'is_active': True,
                    'is_ai_approved': not needs_ai_review,  # Auto-approve if no AI review needed
                    'click_count': 0,
                    'share_count': 0
                }
                
                # Remove None values
                deal_data = {k: v for k, v in deal_data.items() if v is not None}
                
                # Save to database
                deal = Deal(**deal_data)
                db.add(deal)
                saved_deals.append(deal)
                
            except Exception as e:
                print(f"Error processing row {processed_count}: {e}")
                continue
        
        # Commit all deals to database
        await db.commit()
        
        return {
            'success': True,
            'message': f'Successfully uploaded {len(saved_deals)} deals from {file.filename}',
            'file_size': len(content),
            'network': network,
            'description': description,
            'processed_deals': processed_count,
            'valid_deals': len(saved_deals)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/upload-status")
async def get_upload_status():
    """Get upload status"""
    return {
        'status': 'ready',
        'max_file_size': '50MB',
        'supported_formats': ['csv', 'xlsx', 'json', 'xml'],
        'supported_networks': ['amazon', 'cj', 'shareasale', 'rakuten']
    }